import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  applyFieldOverrides,
  CoreApp,
  DataTransformerID,
  type DataFrame,
  type GrafanaTheme2,
  getFrameDisplayName,
  type PanelProps,
  type SelectableValue,
  useDataLinksContext,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getPluginImportUtils, PanelDataErrorView } from '@grafana/runtime';
import { TableCellHeight, type TableOptions } from '@grafana/schema';
import { Combobox, Field, Stack, usePanelContext, useStyles2, useTheme2 } from '@grafana/ui';
import { getSourceFrameIndex } from '@grafana/ui/internal';
import { TableNG } from '@grafana/ui/unstable';
import {
  TABLE_TRANSFORMATIONS_OWNER,
  useAdHocColumnState,
  useCacheFieldDisplayNames,
  useCellActions,
  useCommonTableProps,
  useTableRefreshNewFeatures,
  useTableSharedCrosshair,
} from 'app/features/table/hooks';
import { supportsColumnManagement, withAdHocTransformCapabilities } from 'app/features/table/tableCapabilities';
import { getCurrentFrameIndex, notifyTableFilterError, onColumnResize, onSortByChange } from 'app/features/table/utils';

import { hasDeprecatedParentRowIndex, migrateFromParentRowIndexToNestedFrames } from './migrations';
import { useTableCellAssistant } from './useTableCellAssistant';
import { useTableFieldAssistant } from './useTableFieldAssistant';

interface Props extends PanelProps<TableOptions> {
  initialRowIndex?: number;
  sortByBehavior?: 'initial' | 'managed';
}

export function TablePanel(props: Props) {
  const {
    data,
    height,
    width,
    options,
    fieldConfig,
    id,
    timeRange,
    replaceVariables,
    transparent,
    initialRowIndex,
    sortByBehavior = 'initial',
    fitContent,
  } = props;

  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const panelContext = usePanelContext();
  const { dataLinkPostProcessor } = useDataLinksContext();
  const getActions = useCellActions(replaceVariables);
  const commonTableProps = useCommonTableProps(options, fieldConfig);
  const noPanelPadding = commonTableProps.tableRefreshEnabled;
  const tableRefreshNewFeaturesEnabled = useTableRefreshNewFeatures();
  const adHocTransformationsEnabled = tableRefreshNewFeaturesEnabled && panelContext.app !== CoreApp.PanelEditor;
  const onFieldAddToAssistant = useTableFieldAssistant(props);
  const onCellAddToAssistant = useTableCellAssistant(props);
  const enableSharedCrosshair = useTableSharedCrosshair();
  const frames = hasDeprecatedParentRowIndex(data.series)
    ? migrateFromParentRowIndexToNestedFrames(data.series)
    : data.series;
  const count = frames?.length;
  const hasFields = frames.some((frame) => frame.fields.length > 0);
  const currentIndex = getCurrentFrameIndex(frames, options);
  const outputMain = frames[currentIndex];
  const sourceSeries = adHocTransformationsEnabled
    ? panelContext.adHocTransformations?.getSourceSeries(TABLE_TRANSFORMATIONS_OWNER)
    : undefined;
  const sourceFrameIndex = sourceSeries ? getSourceFrameIndex(frames, currentIndex, sourceSeries) : -1;
  const filterTargetIndex = sourceFrameIndex >= 0 ? sourceFrameIndex : currentIndex;
  const existingRowFilter =
    sourceSeries &&
    panelContext.adHocTransformations
      ?.get(TABLE_TRANSFORMATIONS_OWNER)
      .find(
        (config) =>
          !config.disabled &&
          config.id === DataTransformerID.filterByValue &&
          config.options.target?.frameIndex === filterTargetIndex &&
          config.options.target?.refId === outputMain?.refId
      );
  // A duplicate refId cannot identify a new source, but an existing filter has an exact source index.
  const filterSourceFrameIndex =
    sourceFrameIndex < 0 &&
    existingRowFilter &&
    sourceSeries?.length === frames.length &&
    sourceSeries[currentIndex]?.refId === outputMain?.refId
      ? currentIndex
      : sourceFrameIndex;
  const sourceFrames = sourceSeries ?? frames;
  const sourceFrame = sourceFrames[filterSourceFrameIndex];
  const sourceFrameKey = useMemo(
    () => existingRowFilter?.options.target?.frameKey ?? JSON.stringify([sourceFrame?.refId, filterSourceFrameIndex]),
    [existingRowFilter, sourceFrame?.refId, filterSourceFrameIndex]
  );
  // Rebuild against original rows while retaining cross-frame display and data-link context.
  const sourceFramesWithOverrides = useMemo(
    () =>
      sourceSeries
        ? applyFieldOverrides({
            data: [...sourceSeries],
            fieldConfig,
            fieldConfigRegistry: getPluginImportUtils().getPanelPluginFromCache('table')?.fieldConfigRegistry,
            theme,
            timeZone: props.timeZone,
            replaceVariables,
            dataLinkPostProcessor,
          })
        : undefined,
    [sourceSeries, fieldConfig, theme, props.timeZone, replaceVariables, dataLinkPostProcessor]
  );
  const displayFrames = filterSourceFrameIndex >= 0 && sourceFramesWithOverrides ? sourceFramesWithOverrides : frames;
  useCacheFieldDisplayNames(displayFrames);
  const rawMain = displayFrames[filterSourceFrameIndex >= 0 ? filterSourceFrameIndex : currentIndex] ?? outputMain;
  const configuredSourceSeries = useMemo(
    () =>
      sourceSeries &&
      sourceFramesWithOverrides?.map((frame, frameIndex) => ({
        ...sourceSeries[frameIndex],
        // Runtime transforms match source names, before display-name overrides are applied.
        fields: frame.fields.map((field, fieldIndex) => {
          const sourceField = sourceSeries[frameIndex].fields[fieldIndex];
          return {
            ...sourceField,
            config: {
              ...sourceField.config,
              custom: { ...sourceField.config.custom, hideFrom: field.config.custom?.hideFrom },
            },
          };
        }),
      })),
    [sourceSeries, sourceFramesWithOverrides]
  );
  const columnManagementEnabled = adHocTransformationsEnabled && supportsColumnManagement(rawMain);
  const adHocColumns = useAdHocColumnState(frames, currentIndex, adHocTransformationsEnabled, configuredSourceSeries);
  const main = useMemo(
    () =>
      tableRefreshNewFeaturesEnabled && rawMain
        ? withAdHocTransformCapabilities(rawMain, Boolean(adHocColumns))
        : rawMain,
    [rawMain, tableRefreshNewFeaturesEnabled, adHocColumns]
  );

  // Fit-content: the panel has no fixed height, so self-size from the row count.
  // The cell's CSS min/max bounds (and scrolls) the result.
  let tableHeight = fitContent ? getNaturalTableHeight(main, options) : height;

  if (!count || !hasFields) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  // Under `table.refresh` the panel drops its own padding so the table can run edge to edge, so the
  // frame picker below it has to bring its own.
  if (count > 1 && !fitContent) {
    const inputHeight = theme.spacing.gridSize * theme.components.height.md;
    const padding = theme.spacing.gridSize * (noPanelPadding ? 2 : 1);
    const borderWidth = noPanelPadding ? FRAME_PICKER_BORDER_WIDTH : 0;

    tableHeight = height - inputHeight - padding - borderWidth;
  }

  const tableElement = (
    <TableNG
      {...commonTableProps}
      {...adHocColumns}
      reorderable={Boolean(adHocColumns)}
      showColumnsSidebar={columnManagementEnabled && options.showColumnsSidebar}
      rowTransformationsEnabled={adHocTransformationsEnabled}
      localFilterScope={JSON.stringify([currentIndex, outputMain?.refId])}
      onFilterError={notifyTableFilterError}
      rowTransformations={
        adHocTransformationsEnabled && panelContext.adHocTransformations && filterSourceFrameIndex >= 0
          ? {
              api: panelContext.adHocTransformations,
              owner: TABLE_TRANSFORMATIONS_OWNER,
              frameKey: sourceFrameKey,
              frameIndex: filterSourceFrameIndex,
            }
          : undefined
      }
      initialRowIndex={initialRowIndex}
      height={tableHeight}
      width={width}
      data={main}
      sortByBehavior={sortByBehavior}
      onSortByChange={(sortBy) => onSortByChange(sortBy, props)}
      onColumnResize={(displayName, resizedWidth, fieldScope) =>
        onColumnResize(displayName, resizedWidth, fieldScope, props)
      }
      onCellFilterAdded={panelContext.onAddAdHocFilter}
      onFieldAddToAssistant={onFieldAddToAssistant}
      onCellAddToAssistant={onCellAddToAssistant}
      timeRange={timeRange}
      timeZone={props.timeZone}
      enableSharedCrosshair={enableSharedCrosshair}
      fieldConfig={fieldConfig}
      getActions={getActions}
      structureRev={data.structureRev}
      transparent={transparent}
      noPanelPadding={noPanelPadding}
    />
  );

  if (count === 1) {
    return tableElement;
  }

  const names = frames.map((frame, index) => {
    return {
      label: getFrameDisplayName(frame),
      value: index,
    };
  });

  return (
    <Stack direction="column" gap={noPanelPadding ? 0 : 1.5} justifyContent="space-between" height="100%">
      {tableElement}
      <div className={noPanelPadding ? styles.framePicker : undefined}>
        <Field noMargin>
          <Combobox
            aria-label={t('table.frame-picker.label', 'Query')}
            options={names}
            value={names[currentIndex]}
            onChange={(val) => onChangeTableSelection(val, props)}
          />
        </Field>
      </div>
    </Stack>
  );
}

const FRAME_PICKER_BORDER_WIDTH = 1;

const getStyles = (theme: GrafanaTheme2) => ({
  framePicker: css({
    borderTop: `${FRAME_PICKER_BORDER_WIDTH}px solid ${theme.components.table.border}`,
    paddingInline: theme.spacing(1),
    paddingBlock: theme.spacing(1),
  }),
});

// Approximate row/header pixel sizes used to self-size in fit-content mode.
// Mirrors getDefaultRowHeight in TableNG; exact pixels are not critical because
// the cell's CSS max-height ultimately bounds the panel.
const TABLE_ROW_HEIGHT_SM = 36;
const TABLE_ROW_HEIGHT_MD = 42;
const TABLE_ROW_HEIGHT_LG = 60;
const TABLE_HEADER_HEIGHT = 36;

function getRowPixelHeight(cellHeight: TableCellHeight | undefined): number {
  switch (cellHeight) {
    case TableCellHeight.Sm:
      return TABLE_ROW_HEIGHT_SM;
    case TableCellHeight.Lg:
      return TABLE_ROW_HEIGHT_LG;
    case TableCellHeight.Md:
    default:
      return TABLE_ROW_HEIGHT_MD;
  }
}

function getNaturalTableHeight(frame: DataFrame | undefined, options: TableOptions): number {
  const rowCount = frame?.length ?? 0;
  const headerHeight = options.showHeader === false ? 0 : TABLE_HEADER_HEIGHT;
  return headerHeight + rowCount * getRowPixelHeight(options.cellHeight);
}
function onChangeTableSelection(val: SelectableValue<number>, props: Props) {
  props.onOptionsChange({
    ...props.options,
    frameIndex: val.value || 0,
  });
}
