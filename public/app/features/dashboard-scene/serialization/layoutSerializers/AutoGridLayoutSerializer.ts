import { DataFrame, FieldType, LoadingState, PanelData } from '@grafana/data';
import { SceneDataNode, sceneGraph, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import {
  Spec as DashboardV2Spec,
  defaultAutoGridLayoutSpec,
  AutoGridLayoutItemKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import {
  AUTO_GRID_DEFAULT_COLUMN_WIDTH,
  AUTO_GRID_DEFAULT_ROW_HEIGHT,
  AutoGridColumnWidth,
  AutoGridRowHeight,
  getAutoRowsTemplate,
  getTemplateColumnsTemplate,
  AutoGridLayoutManager,
} from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { getCloneKey } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getGridItemKeyForPanelId } from '../../utils/utils';

import { buildLibraryPanel, buildVizPanel, getConditionalRendering } from './utils';

export function serializeAutoGridLayout(layoutManager: AutoGridLayoutManager): DashboardV2Spec['layout'] {
  const { maxColumnCount, fillScreen, columnWidth, rowHeight, layout } = layoutManager.state;
  const defaults = defaultAutoGridLayoutSpec();

  return {
    kind: 'AutoGridLayout',
    spec: {
      maxColumnCount,
      fillScreen: fillScreen === defaults.fillScreen ? undefined : fillScreen,
      ...serializeAutoGridColumnWidth(columnWidth),
      ...serializeAutoGridRowHeight(rowHeight),
      items: layout.state.children.map(serializeAutoGridItem),
    },
  };
}

export function serializeAutoGridItem(item: AutoGridItem): AutoGridLayoutItemKind {
  // For serialization we should retrieve the original element key
  const elementKey = dashboardSceneGraph.getElementIdentifierForVizPanel(item.state?.body);

  const layoutItem: AutoGridLayoutItemKind = {
    kind: 'AutoGridLayoutItem',
    spec: {
      element: {
        kind: 'ElementReference',
        name: elementKey,
      },
    },
  };

  const conditionalRenderingRootGroup = item.state.conditionalRendering?.serialize();
  // Only serialize the conditional rendering if it has items
  if (conditionalRenderingRootGroup?.spec.items.length) {
    layoutItem.spec.conditionalRendering = conditionalRenderingRootGroup;
  }

  if (item.state.variableName) {
    layoutItem.spec.repeat = {
      mode: 'variable',
      value: item.state.variableName,
    };
  } else if (item.state.splitSeriesByLabel) {
    layoutItem.spec.repeat = {
      mode: 'splitByLabel',
      value: item.state.splitSeriesByLabel,
    };
  }

  return layoutItem;
}

export function deserializeAutoGridLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: () => number
): AutoGridLayoutManager {
  if (layout.kind !== 'AutoGridLayout') {
    throw new Error('Invalid layout kind');
  }

  const defaults = defaultAutoGridLayoutSpec();
  const { maxColumnCount, columnWidthMode, columnWidth, rowHeightMode, rowHeight, fillScreen } = layout.spec;

  const children = layout.spec.items.map((item) => deserializeAutoGridItem(item, elements, panelIdGenerator));

  const columnWidthCombined = columnWidthMode === 'custom' ? columnWidth : columnWidthMode;
  const rowHeightCombined = rowHeightMode === 'custom' ? rowHeight : rowHeightMode;

  return new AutoGridLayoutManager({
    maxColumnCount,
    columnWidth: columnWidthCombined,
    rowHeight: rowHeightCombined,
    fillScreen: fillScreen ?? defaults.fillScreen,
    layout: new AutoGridLayout({
      templateColumns: getTemplateColumnsTemplate(
        maxColumnCount ?? defaults.maxColumnCount!,
        columnWidthCombined ?? AUTO_GRID_DEFAULT_COLUMN_WIDTH
      ),
      autoRows: getAutoRowsTemplate(rowHeightCombined ?? AUTO_GRID_DEFAULT_ROW_HEIGHT, fillScreen ?? false),
      children,
    }),
  });
}

function serializeAutoGridColumnWidth(columnWidth: AutoGridColumnWidth) {
  return {
    columnWidthMode: typeof columnWidth === 'number' ? 'custom' : columnWidth,
    columnWidth: typeof columnWidth === 'number' ? columnWidth : undefined,
  };
}

function serializeAutoGridRowHeight(rowHeight: AutoGridRowHeight) {
  return {
    rowHeightMode: typeof rowHeight === 'number' ? 'custom' : rowHeight,
    rowHeight: typeof rowHeight === 'number' ? rowHeight : undefined,
  };
}

export function deserializeAutoGridItem(
  item: AutoGridLayoutItemKind,
  elements: DashboardV2Spec['elements'],
  panelIdGenerator?: () => number
): AutoGridItem {
  const panel = elements[item.spec.element.name];
  if (!panel) {
    throw new Error(`Panel with uid ${item.spec.element.name} not found in the dashboard elements`);
  }
  let id: number | undefined;
  if (panelIdGenerator) {
    id = panelIdGenerator();
  }

  const splitSeriesByLabel = item.spec.repeat?.mode === 'splitByLabel' ? item.spec.repeat.value : undefined;

  return new AutoGridItem({
    key: getGridItemKeyForPanelId(id ?? panel.spec.id),
    body:
      panel.kind === 'LibraryPanel'
        ? buildLibraryPanel(panel, id)
        : buildVizPanel(panel, id, splitSeriesByLabel ? splitByLabelProcessorFactory(splitSeriesByLabel) : undefined),
    variableName: item.spec.repeat?.mode === 'variable' ? item.spec.repeat?.value : undefined,
    splitSeriesByLabel,
    conditionalRendering: getConditionalRendering(item),
  });
}

const MISSING_LABEL_BUCKET_KEY = '(missing)';

export function groupFramesByLabel(
  frames: DataFrame[],
  labelKey: string
): { groups: Map<string, DataFrame[]>; missing: DataFrame[] } {
  const groups = new Map<string, DataFrame[]>();
  const missing: DataFrame[] = [];

  for (const frame of frames) {
    let labelValue: string | undefined;
    for (const field of frame.fields) {
      // Skip time fields early (common case for time series data).
      if (field.type === FieldType.time) {
        continue;
      }

      const v = field.labels?.[labelKey];
      if (v !== undefined) {
        labelValue = String(v);
        break;
      }
    }

    if (labelValue === undefined) {
      missing.push(frame);
      continue;
    }

    const bucket = groups.get(labelValue);
    if (bucket) {
      bucket.push(frame);
    } else {
      groups.set(labelValue, [frame]);
    }
  }

  return { groups, missing };
}

export function splitByLabelProcessorFactory(
  split: string
): (queryRunner: SceneQueryRunner, data: PanelData) => PanelData {
  let prevBucketKeys: string[] | undefined;

  return (queryRunner, data) => {
    if (data.state === LoadingState.Loading) {
      return data;
    }

    const gridItem = sceneGraph.getAncestor(queryRunner, AutoGridItem);
    if (!gridItem) {
      return data;
    }

    const splitKey = sceneGraph.interpolate(queryRunner, split).trim();
    if (!splitKey) {
      // Without a usable label key we can't split; behave like non-repeat.
      if (gridItem.state.repeatedPanels?.length) {
        gridItem.setState({ repeatedPanels: [] });
      }
      prevBucketKeys = undefined;
      return data;
    }

    const sourcePanel = gridItem.state.body;
    const { groups, missing } = groupFramesByLabel(data.series, splitKey);

    const buckets: Array<{ key: string; series: DataFrame[] }> = Array.from(groups.entries()).map(([key, series]) => ({
      key,
      series,
    }));
    if (missing.length > 0) {
      buckets.push({ key: MISSING_LABEL_BUCKET_KEY, series: missing });
    }

    if (buckets.length === 0) {
      // No label groups and no missing-label series: behave like non-repeat.
      if (gridItem.state.repeatedPanels?.length) {
        gridItem.setState({ repeatedPanels: [] });
      }
      prevBucketKeys = undefined;
      return data;
    }

    const bucketKeys = buckets.map((b) => b.key);

    // Source panel shows the first bucket only.
    const processedData: PanelData = {
      ...data,
      series: buckets[0].series,
    };

    const hasSameBuckets =
      prevBucketKeys?.length === bucketKeys.length && prevBucketKeys.every((k, idx) => k === bucketKeys[idx]);

    const repeatBuckets = buckets.slice(1);
    let repeatedPanels: VizPanel[] = gridItem.state.repeatedPanels ?? [];

    if (!hasSameBuckets || repeatedPanels.length !== repeatBuckets.length) {
      repeatedPanels = repeatBuckets.map((_, idx) =>
        sourcePanel.clone({
          key: getCloneKey(sourcePanel.state.key!, idx + 1),
          repeatSourceKey: sourcePanel.state.key,
        })
      );
    }

    // Always update the data for each repeated panel (data changes even if bucket keys do not).
    for (let idx = 0; idx < repeatBuckets.length; idx++) {
      repeatedPanels[idx].setState({
        $data: new SceneDataNode({
          data: {
            ...data,
            series: repeatBuckets[idx].series,
          },
        }),
      });
    }

    // Only set grid item state if something structural changed (count/order).
    if (!hasSameBuckets || gridItem.state.repeatedPanels?.length !== repeatedPanels.length) {
      gridItem.setState({ repeatedPanels });
    }

    prevBucketKeys = bucketKeys;
    return processedData;
  };
}
