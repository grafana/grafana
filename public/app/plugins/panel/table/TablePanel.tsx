import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import {
  DashboardCursorSync,
  type DataFrame,
  getFrameDisplayName,
  type PanelProps,
  type SelectableValue,
  type Field,
  cacheFieldDisplayNames,
} from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { useFlagTableProtoRowParser, useFlagTableRefactorNested } from '@grafana/runtime/internal';
import { Combobox, usePanelContext, useTheme2 } from '@grafana/ui';
import { TableNG } from '@grafana/ui/unstable';
import { getConfig } from 'app/core/config';
import { getCellActions, getCurrentFrameIndex, onColumnResize, onSortByChange } from 'app/features/table/utils';

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
  } = props;

  useMemo(() => {
    cacheFieldDisplayNames(data.series);
  }, [data.series]);

  const tableProtoParserEnabled = useFlagTableProtoRowParser();
  const nestedRefactorEnabled = useFlagTableRefactorNested();
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

  let tableHeight = height;

  if (!count || !hasFields) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  if (count > 1) {
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
      nestedRefactorEnabled={nestedRefactorEnabled}
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

function onChangeTableSelection(val: SelectableValue<number>, props: Props) {
  props.onOptionsChange({
    ...props.options,
    frameIndex: val.value || 0,
  });
}

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
