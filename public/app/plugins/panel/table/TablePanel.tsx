import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import {
  type ActionModel,
  DashboardCursorSync,
  type DataFrame,
  FieldMatcherID,
  getFrameDisplayName,
  type InterpolateFunction,
  type PanelProps,
  type SelectableValue,
  type Field,
  cacheFieldDisplayNames,
} from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { useFlagTableProtoRowParser } from '@grafana/runtime/internal';
import { type MatcherScope, TableCellHeight } from '@grafana/schema';
import { Combobox, usePanelContext, useTheme2 } from '@grafana/ui';
import { type TableSortByFieldState } from '@grafana/ui/internal';
import { TableNG } from '@grafana/ui/unstable';
import { getConfig } from 'app/core/config';
import { getActions } from 'app/features/actions/utils';

import { hasDeprecatedParentRowIndex, migrateFromParentRowIndexToNestedFrames } from './migrations';
import { type Options } from './panelcfg.gen';

interface Props extends PanelProps<Options> {
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

  useMemo(() => {
    cacheFieldDisplayNames(data.series);
  }, [data.series]);

  const tableProtoParserEnabled = useFlagTableProtoRowParser();
  const theme = useTheme2();
  const panelContext = usePanelContext();
  const userCanExecuteActions = useMemo(() => panelContext.canExecuteActions?.() ?? false, [panelContext]);
  const _getActions = useCallback(
    (frame: DataFrame, field: Field, rowIndex: number) =>
      userCanExecuteActions ? getCellActions(frame, field, rowIndex, replaceVariables) : [],
    [replaceVariables, userCanExecuteActions]
  );
  const frames = hasDeprecatedParentRowIndex(data.series)
    ? migrateFromParentRowIndexToNestedFrames(data.series)
    : data.series;
  const count = frames?.length;
  const hasFields = frames.some((frame) => frame.fields.length > 0);
  const currentIndex = getCurrentFrameIndex(frames, options);
  const main = frames[currentIndex];

  // Fit-content: the panel has no fixed height, so self-size from the row count.
  // The cell's CSS min/max bounds (and scrolls) the result.
  let tableHeight = fitContent ? getNaturalTableHeight(main, options) : height;

  if (!count || !hasFields) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  if (count > 1 && !fitContent) {
    const inputHeight = theme.spacing.gridSize * theme.components.height.md;
    const padding = theme.spacing.gridSize;

    tableHeight = height - inputHeight - padding;
  }

  const enableSharedCrosshair = panelContext.sync && panelContext.sync() !== DashboardCursorSync.Off;

  const disableSanitizeHtml = getConfig().disableSanitizeHtml;

  const tableElement = (
    <TableNG
      initialRowIndex={initialRowIndex}
      height={tableHeight}
      width={width}
      data={main}
      noHeader={!options.showHeader}
      noValue={fieldConfig.defaults.noValue}
      showTypeIcons={options.showTypeIcons}
      resizable={true}
      sortByBehavior={sortByBehavior}
      sortBy={options.sortBy}
      onSortByChange={(sortBy) => onSortByChange(sortBy, props)}
      onColumnResize={(displayName, resizedWidth, fieldScope) =>
        onColumnResize(displayName, resizedWidth, fieldScope, props)
      }
      onCellFilterAdded={panelContext.onAddAdHocFilter}
      frozenColumns={options.frozenColumns?.left}
      enablePagination={options.enablePagination}
      cellHeight={options.cellHeight}
      maxRowHeight={options.maxRowHeight}
      timeRange={timeRange}
      enableSharedCrosshair={config.featureToggles.tableSharedCrosshair && enableSharedCrosshair}
      fieldConfig={fieldConfig}
      getActions={_getActions}
      structureRev={data.structureRev}
      transparent={transparent}
      disableSanitizeHtml={disableSanitizeHtml}
      disableKeyboardEvents={options.disableKeyboardEvents}
      protoParserEnabled={tableProtoParserEnabled}
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
    <div className={tableStyles.wrapper}>
      {tableElement}
      <div className={tableStyles.selectWrapper}>
        <Combobox options={names} value={names[currentIndex]} onChange={(val) => onChangeTableSelection(val, props)} />
      </div>
    </div>
  );
}

function getCurrentFrameIndex(frames: DataFrame[], options: Options) {
  return options.frameIndex > 0 && options.frameIndex < frames.length ? options.frameIndex : 0;
}

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

function getNaturalTableHeight(frame: DataFrame | undefined, options: Options): number {
  const rowCount = frame?.length ?? 0;
  const headerHeight = options.showHeader === false ? 0 : TABLE_HEADER_HEIGHT;
  return headerHeight + rowCount * getRowPixelHeight(options.cellHeight);
}

export function onColumnResize(
  fieldDisplayName: string,
  width: number,
  fieldScope: MatcherScope = 'series',
  props: Pick<Props, 'fieldConfig' | 'onFieldConfigChange'>
) {
  const { fieldConfig } = props;
  const { overrides } = fieldConfig;

  const matcherId = FieldMatcherID.byName;
  const propId = 'custom.width';

  // look for existing override. an unscoped override is treated as implicitly 'series'.
  const override = overrides.find(
    (o) =>
      o.matcher.id === matcherId &&
      o.matcher.options === fieldDisplayName &&
      (o.matcher.scope ?? 'series') === fieldScope
  );

  if (override) {
    // look for existing property
    const property = override.properties.find((prop) => prop.id === propId);
    if (property) {
      property.value = width;
    } else {
      override.properties.push({ id: propId, value: width });
    }
  } else {
    overrides.push({
      matcher: { id: matcherId, options: fieldDisplayName, scope: fieldScope },
      properties: [{ id: propId, value: width }],
    });
  }

  props.onFieldConfigChange({
    ...fieldConfig,
    overrides,
  });
}

function onSortByChange(sortBy: TableSortByFieldState[], props: Props) {
  props.onOptionsChange({
    ...props.options,
    sortBy,
  });
}

function onChangeTableSelection(val: SelectableValue<number>, props: Props) {
  props.onOptionsChange({
    ...props.options,
    frameIndex: val.value || 0,
  });
}

// placeholder function; assuming the values are already interpolated
const replaceVars: InterpolateFunction = (value: string) => value;

const getCellActions = (
  dataFrame: DataFrame,
  field: Field,
  rowIndex: number,
  replaceVariables: InterpolateFunction | undefined
): Array<ActionModel<Field>> => {
  const numActions = field.config.actions?.length ?? 0;

  if (numActions > 0) {
    const actions = getActions(
      dataFrame,
      field,
      field.state!.scopedVars!,
      replaceVariables ?? replaceVars,
      field.config.actions ?? [],
      { valueRowIndex: rowIndex },
      'table'
    );

    if (actions.length === 1) {
      return actions;
    } else {
      const actionsOut: Array<ActionModel<Field>> = [];
      const actionLookup = new Set<string>();

      actions.forEach((action) => {
        const key = action.title;

        if (!actionLookup.has(key)) {
          actionsOut.push(action);
          actionLookup.add(key);
        }
      });

      return actionsOut;
    }
  }

  return [];
};

const tableStyles = {
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  }),
  selectWrapper: css({
    padding: '8px 8px 0px 8px',
  }),
};
