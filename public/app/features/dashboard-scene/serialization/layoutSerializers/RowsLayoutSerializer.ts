import { config, getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, GroupByVariable, SceneVariableSet } from '@grafana/scenes';
import {
  defaultAdhocVariableKind,
  defaultGroupByVariableKind,
  GroupByVariableKind,
  AdhocVariableKind,
  Spec as DashboardV2Spec,
  RowsLayoutRowKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { sceneVariablesSetToSchemaV2Variables } from '../sceneVariablesSetToVariables';
import { transformVariableHideToEnumV1 } from '../transformToV1TypesUtils';

import { layoutDeserializerRegistry } from './layoutSerializerRegistry';
import { getConditionalRendering, getDataSourceForQuery } from './utils';

export function serializeRowsLayout(layoutManager: RowsLayoutManager): DashboardV2Spec['layout'] {
  return {
    kind: 'RowsLayout',
    spec: {
      rows: layoutManager.state.rows.filter((row) => !row.state.repeatSourceKey).map(serializeRow),
    },
  };
}

export function serializeRow(row: RowItem): RowsLayoutRowKind {
  const layout = row.state.layout.serialize();

  // Normalize Y coordinates to be relative within the row
  // Panels in the scene have absolute Y coordinates, but in V2 schema they should be relative to the row
  if (layout.kind === 'GridLayout' && layout.spec.items.length > 0) {
    // Find the minimum Y coordinate among all items in this row
    const minY = Math.min(...layout.spec.items.map((item) => item.spec.y));

    // Subtract minY from each item's Y to make coordinates relative to the row start
    layout.spec.items = layout.spec.items.map((item) => ({
      ...item,
      spec: {
        ...item.spec,
        y: item.spec.y - minY,
      },
    }));
  }

  const rowKind: RowsLayoutRowKind = {
    kind: 'RowsLayoutRow',
    spec: {
      title: row.state.title,
      collapse: row.state.collapse ?? false,
      layout: layout,
      fillScreen: row.state.fillScreen,
      hideHeader: row.state.hideHeader,
      ...(row.state.repeatByVariable && {
        repeat: {
          mode: 'variable',
          value: row.state.repeatByVariable,
        },
      }),
    },
  };

  const rowVariablesSet = row.state.$variables;
  if (rowVariablesSet) {
    const rowVariables = sceneVariablesSetToSchemaV2Variables(rowVariablesSet).filter(
      (variable) =>
        variable.kind === defaultAdhocVariableKind().kind || variable.kind === defaultGroupByVariableKind().kind
    );
    if (rowVariables.length > 0) {
      rowKind.spec.variables = rowVariables;
    }
  }

  const conditionalRenderingRootGroup = row.state.conditionalRendering?.serialize();
  // Only serialize the conditional rendering if it has items
  if (conditionalRenderingRootGroup?.spec.items.length) {
    rowKind.spec.conditionalRendering = conditionalRenderingRootGroup;
  }

  return rowKind;
}

export function deserializeRowsLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: () => number
): RowsLayoutManager {
  if (layout.kind !== 'RowsLayout') {
    throw new Error('Invalid layout kind');
  }
  const rows = layout.spec.rows.map((row) => deserializeRow(row, elements, preload, panelIdGenerator));
  return new RowsLayoutManager({ rows });
}

export function deserializeRow(
  row: RowsLayoutRowKind,
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: () => number
): RowItem {
  const layout = row.spec.layout;
  const variables = createRowVariables(row.spec.variables);

  return new RowItem({
    title: row.spec.title,
    collapse: row.spec.collapse,
    hideHeader: row.spec.hideHeader,
    fillScreen: row.spec.fillScreen,
    repeatByVariable: row.spec.repeat?.value,
    layout: layoutDeserializerRegistry.get(layout.kind).deserialize(layout, elements, preload, panelIdGenerator),
    conditionalRendering: getConditionalRendering(row),
    $variables: variables,
  });
}

function createRowVariables(variables?: Array<AdhocVariableKind | GroupByVariableKind>): SceneVariableSet | undefined {
  if (!variables || variables.length === 0) {
    return undefined;
  }

  const sceneVariables = variables
    .map((variable) => {
      if (variable.kind === defaultAdhocVariableKind().kind) {
        const ds = getDataSourceForQuery(
          {
            type: variable.group,
            uid: variable.datasource?.name,
          },
          variable.group
        );

        const adhocVariableState: AdHocFiltersVariable['state'] = {
          name: variable.spec.name,
          label: variable.spec.label,
          description: variable.spec.description,
          type: 'adhoc',
          skipUrlSync: variable.spec.skipUrlSync,
          hide: transformVariableHideToEnumV1(variable.spec.hide),
          datasource: ds,
          applyMode: 'auto',
          filters: variable.spec.filters ?? [],
          baseFilters: variable.spec.baseFilters ?? [],
          defaultKeys: variable.spec.defaultKeys.length ? variable.spec.defaultKeys : undefined,
          useQueriesAsFilterForOptions: true,
          drilldownRecommendationsEnabled: config.featureToggles.drilldownRecommendations,
          layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
          supportsMultiValueOperators: Boolean(
            getDataSourceSrv().getInstanceSettings({ type: ds?.type })?.meta.multiValueFilterOperators
          ),
          collapsible: config.featureToggles.dashboardAdHocAndGroupByWrapper,
        };
        if (variable.spec.allowCustomValue !== undefined) {
          adhocVariableState.allowCustomValue = variable.spec.allowCustomValue;
        }
        return new AdHocFiltersVariable(adhocVariableState);
      }

      if (config.featureToggles.groupByVariable && variable.kind === defaultGroupByVariableKind().kind) {
        const ds = getDataSourceForQuery(
          {
            type: variable.group,
            uid: variable.datasource?.name,
          },
          variable.group
        );

        return new GroupByVariable({
          name: variable.spec.name,
          label: variable.spec.label,
          description: variable.spec.description,
          datasource: ds,
          value: variable.spec.current?.value || [],
          text: variable.spec.current?.text || [],
          skipUrlSync: variable.spec.skipUrlSync,
          isMulti: variable.spec.multi,
          hide: transformVariableHideToEnumV1(variable.spec.hide),
          wideInput: config.featureToggles.dashboardAdHocAndGroupByWrapper,
          drilldownRecommendationsEnabled: config.featureToggles.drilldownRecommendations,
          // @ts-expect-error
          defaultOptions: variable.options,
        });
      }

      return null;
    })
    .filter((variable): variable is AdHocFiltersVariable | GroupByVariable => Boolean(variable));

  if (sceneVariables.length === 0) {
    return undefined;
  }

  return new SceneVariableSet({
    variables: sceneVariables,
  });
}
