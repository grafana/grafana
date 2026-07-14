import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import {
  cacheFieldDisplayNames,
  DashboardCursorSync,
  type DataFrame,
  type Field,
  type GrafanaTheme2,
  LogSortOrderChangeEvent,
  LogsSortOrder,
  type PanelProps,
  store,
} from '@grafana/data';
import { config, getAppEvents } from '@grafana/runtime';
import { useFlagTableProtoRowParser, useFlagTableRefactorNested } from '@grafana/runtime/internal';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { TableNG } from '@grafana/ui/unstable';
import { getConfig } from 'app/core/config';
import { getDefaultFieldSelectorWidth } from 'app/features/logs/components/fieldSelector/FieldSelector';
import { getDefaultControlsExpandedMode } from 'app/features/logs/components/panel/LogListContext';
import { CONTROLS_WIDTH_EXPANDED } from 'app/features/logs/components/panel/LogListControls';
import { LogTableControls } from 'app/features/logs/components/panel/LogTableControls';
import { LOG_LIST_CONTROLS_WIDTH } from 'app/features/logs/components/panel/virtualization';
import { dataFrameToLogsModel } from 'app/features/logs/logsModel';
import { type DownloadFormat, downloadLogs as download } from 'app/features/logs/utils';
import { getCellActions, getCurrentFrameIndex, onColumnResize, onSortByChange } from 'app/features/table/utils';

import { type Options } from './options/types';
import { defaultOptions } from './panelcfg.gen';

interface Props extends Omit<PanelProps<Options>, 'timeRange'> {
  initialRowIndex?: number;
  logOptionsStorageKey: string;
  containerElement: HTMLDivElement;
  onWrapTextClick: () => void;
}

export function TableNGWrap({
  data,
  options,
  onOptionsChange,
  height,
  width: tableWidth,
  transparent,
  fieldConfig,
  onFieldConfigChange,
  replaceVariables,
  initialRowIndex,
  logOptionsStorageKey,
  containerElement,
  onWrapTextClick,
}: Props) {
  useMemo(() => {
    cacheFieldDisplayNames(data.series);
  }, [data.series]);

  const panelContext = usePanelContext();
  const protoParserEnabled = useFlagTableProtoRowParser();
  const nestedRefactorEnabled = useFlagTableRefactorNested();
  const userCanExecuteActions = useMemo(() => panelContext.canExecuteActions?.() ?? false, [panelContext]);
  const getActions = useCallback(
    (frame: DataFrame, field: Field, rowIndex: number) =>
      userCanExecuteActions ? getCellActions(frame, field, rowIndex, replaceVariables) : [],
    [replaceVariables, userCanExecuteActions]
  );
  const fieldSelectorWidth = options.fieldSelectorWidth ?? getDefaultFieldSelectorWidth();
  const showControls = options.showControls ?? defaultOptions.showControls ?? true;
  const controlsExpandedFromStore = store.getBool(
    `${logOptionsStorageKey}.controlsExpanded`,
    getDefaultControlsExpandedMode(containerElement ?? null)
  );

  const [controlsExpanded, setControlsExpanded] = useState(controlsExpandedFromStore);
  const controlsWidth = !showControls ? 0 : controlsExpanded ? CONTROLS_WIDTH_EXPANDED : LOG_LIST_CONTROLS_WIDTH;
  const styles = useStyles2(getStyles, fieldSelectorWidth, height, tableWidth, controlsWidth);

  const handleSortOrderChange = useCallback(
    (sortOrder: LogsSortOrder) => {
      getAppEvents().publish(
        new LogSortOrderChangeEvent({
          order: sortOrder,
        })
      );
      onOptionsChange({ ...options, sortOrder });
    },
    [onOptionsChange, options]
  );

  const downloadLogs = useCallback(
    (format: DownloadFormat) => {
      // converting to logsModel is a lot of unnecessary compute, but since this is only called on user action it should work as a short-term solution
      const { meta, rows } = dataFrameToLogsModel(data.series);
      download(format, rows, meta, options.displayedFields);
    },
    [data.series, options.displayedFields]
  );

  return (
    <div className={styles.tableWrapper}>
      {showControls && (
        <div className={styles.listControlsWrapper}>
          <LogTableControls
            allowDownload={options.allowDownload}
            logOptionsStorageKey={logOptionsStorageKey}
            controlsExpanded={controlsExpanded}
            setControlsExpanded={setControlsExpanded}
            sortOrder={options.sortOrder ?? LogsSortOrder.Descending}
            setSortOrder={handleSortOrderChange}
            downloadLogs={downloadLogs}
            onWrapTextClick={onWrapTextClick}
            wrapText={Boolean(options.wrapText)}
          />
        </div>
      )}

      <TableNG
        sortByBehavior="managed"
        initialRowIndex={initialRowIndex}
        data={data.series[getCurrentFrameIndex(data.series, options)]}
        timeRange={data.timeRange}
        width={Math.max(tableWidth - fieldSelectorWidth - controlsWidth, 0)}
        height={height}
        noHeader={!options.showHeader}
        noValue={fieldConfig.defaults.noValue}
        showTypeIcons={options.showTypeIcons}
        resizable={true}
        sortBy={options.sortBy}
        onSortByChange={(sortBy) => onSortByChange(sortBy, { onOptionsChange, options })}
        onColumnResize={(displayName, resizedWidth, fieldScope) =>
          onColumnResize(displayName, resizedWidth, fieldScope, { fieldConfig, onFieldConfigChange })
        }
        onCellFilterAdded={panelContext.onAddAdHocFilter}
        frozenColumns={options.frozenColumns?.left}
        enablePagination={options.enablePagination}
        cellHeight={options.cellHeight}
        maxRowHeight={options.maxRowHeight}
        enableSharedCrosshair={
          Boolean(config.featureToggles.tableSharedCrosshair) &&
          Boolean(panelContext.sync) &&
          panelContext.sync!() !== DashboardCursorSync.Off
        }
        fieldConfig={fieldConfig}
        getActions={getActions}
        structureRev={data.structureRev}
        transparent={transparent}
        disableSanitizeHtml={getConfig().disableSanitizeHtml}
        disableKeyboardEvents={options.disableKeyboardEvents}
        protoParserEnabled={protoParserEnabled}
        nestedRefactorEnabled={nestedRefactorEnabled}
      />
    </div>
  );
}

const getStyles = (
  _: GrafanaTheme2,
  fieldSelectorWidth: number,
  height: number,
  tableWidth: number,
  controlsWidth: number
) => {
  return {
    listControlsWrapper: css({
      height: '100%',
      width: controlsWidth,
      label: 'listControlsWrapper',
      // Needed to keep the panel menu from overlapping the logs options when there's no title
      position: 'absolute',
      right: 0,
      top: 0,
    }),
    tableWrapper: css({
      position: 'relative',
      paddingLeft: fieldSelectorWidth,
      paddingRight: controlsWidth,
      height,
      width: tableWidth,
    }),
  };
};
