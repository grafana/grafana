import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import {
  type DataFrame,
  type GrafanaTheme2,
  LogSortOrderChangeEvent,
  LogsSortOrder,
  type PanelProps,
  store,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { ConfirmModal, Icon, usePanelContext, useStyles2 } from '@grafana/ui';
import { TableNG } from '@grafana/ui/unstable';
import { PopoverMenu } from 'app/features/explore/Logs/PopoverMenu';
import { getDefaultFieldSelectorWidth } from 'app/features/logs/components/fieldSelector/FieldSelector';
import { getDefaultControlsExpandedMode } from 'app/features/logs/components/panel/LogListContext';
import { CONTROLS_WIDTH_EXPANDED } from 'app/features/logs/components/panel/LogListControls';
import { LogTableControls } from 'app/features/logs/components/panel/LogTableControls';
import { LOG_LIST_CONTROLS_WIDTH } from 'app/features/logs/components/panel/virtualization';
import { dataFrameToLogsModel } from 'app/features/logs/logsModel';
import { type DownloadFormat, downloadLogs as download } from 'app/features/logs/utils';
import {
  useCacheFieldDisplayNames,
  useCellActions,
  useCommonTableProps,
  useTableSharedCrosshair,
} from 'app/features/table/hooks';
import { getCurrentFrameIndex, notifyTableFilterError, onColumnResize, onSortByChange } from 'app/features/table/utils';

import { useLogDetailsContext } from './LogDetailsContext';
import { useLogsTablePopoverMenu } from './hooks/useLogsTablePopoverMenu';
import { type Options } from './options/types';
import { defaultOptions } from './panelcfg.gen';
import { isOnClickFilterOutString, isOnClickFilterString } from './types';

interface Props extends Omit<PanelProps<Options>, 'timeRange'> {
  initialRowIndex?: number;
  logOptionsStorageKey: string;
  containerElement: HTMLDivElement;
  onWrapTextClick: () => void;
  rawDataFrame: DataFrame | null;
}

export function TableNGWrap({
  data,
  options,
  onOptionsChange,
  height,
  width: tableWidth,
  transparent,
  timeZone,
  fieldConfig,
  onFieldConfigChange,
  replaceVariables,
  initialRowIndex,
  logOptionsStorageKey,
  containerElement,
  onWrapTextClick,
  rawDataFrame,
}: Props) {
  useCacheFieldDisplayNames(data.series);

  const { setDisplayedRowIndices } = useLogDetailsContext();
  const panelContext = usePanelContext();
  const getActions = useCellActions(replaceVariables);
  const commonTableProps = useCommonTableProps(options, fieldConfig);
  const enableSharedCrosshair = useTableSharedCrosshair();
  const fieldSelectorWidth = options.fieldSelectorWidth ?? getDefaultFieldSelectorWidth();
  const showControls = options.showControls ?? defaultOptions.showControls ?? true;
  const controlsExpandedFromStore = store.getBool(
    `${logOptionsStorageKey}.controlsExpanded`,
    getDefaultControlsExpandedMode(containerElement ?? null)
  );

  const [controlsExpanded, setControlsExpanded] = useState(controlsExpandedFromStore);
  const controlsWidth = !showControls ? 0 : controlsExpanded ? CONTROLS_WIDTH_EXPANDED : LOG_LIST_CONTROLS_WIDTH;
  const styles = useStyles2(getStyles, fieldSelectorWidth, height, tableWidth, controlsWidth);

  const onClickFilterString = isOnClickFilterString(options.onClickFilterString)
    ? options.onClickFilterString
    : undefined;
  const onClickFilterOutString = isOnClickFilterOutString(options.onClickFilterOutString)
    ? options.onClickFilterOutString
    : undefined;
  const {
    closePopoverMenu,
    handleTextSelection,
    onDisableCancel,
    onDisableConfirm,
    onDisablePopoverMenu,
    popoverState,
    showDisablePopoverOptions,
  } = useLogsTablePopoverMenu({ containerElement, onClickFilterString, onClickFilterOutString });
  const refId = rawDataFrame?.refId;
  const datasourceType = useMemo(
    () => data.request?.targets.find((query) => query.refId === refId)?.datasource?.type,
    [data.request?.targets, refId]
  );

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
      if (!rawDataFrame) {
        return;
      }
      // converting to logsModel is a lot of unnecessary compute, but since this is only called on user action it should work as a short-term solution
      const { meta, rows } = dataFrameToLogsModel([rawDataFrame]);
      download(format, rows, meta, options.displayedFields);
    },
    [options.displayedFields, rawDataFrame]
  );

  return (
    <>
      {popoverState.selection && (
        <PopoverMenu
          close={closePopoverMenu}
          refId={refId}
          datasourceType={datasourceType}
          selection={popoverState.selection}
          {...popoverState.coordinates}
          onClickFilterString={onClickFilterString}
          onClickFilterOutString={onClickFilterOutString}
          onDisable={onDisablePopoverMenu}
        />
      )}
      {showDisablePopoverOptions && (
        <ConfirmModal
          isOpen
          title={t('logs.log-rows.disable-popover.title', 'Disable menu')}
          body={
            <>
              <Trans i18nKey="logs.log-rows.disable-popover.message">
                You are about to disable the logs filter menu. To re-enable it, select text in a log line while holding
                the alt key.
              </Trans>
              <div className={styles.shortcut}>
                <Icon name="keyboard" />
                <Trans i18nKey="logs.log-rows.disable-popover-message.shortcut">alt+select to enable again</Trans>
              </div>
            </>
          }
          confirmText={t('logs.log-rows.disable-popover.confirm', 'Confirm')}
          onConfirm={onDisableConfirm}
          onDismiss={onDisableCancel}
        />
      )}
      {/* Selecting text finishes with a click, which is what triggers the popover menu. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className={styles.tableWrapper} onClick={handleTextSelection}>
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
          {...commonTableProps}
          // `useCommonTableProps` reports the `table.refresh` flag, but the refreshed header hasn't
          // been designed against the Logs Table's own header controls yet, so this panel opts out
          // until that work happens.
          tableRefreshEnabled={false}
          // JSON syntax highlighting is currently limited to the standard Table panel.
          jsonSyntaxHighlightingEnabled={false}
          sortByBehavior="managed"
          initialRowIndex={initialRowIndex}
          data={data.series[getCurrentFrameIndex(data.series, options)]}
          onFilterError={notifyTableFilterError}
          timeRange={data.timeRange}
          timeZone={timeZone}
          width={Math.max(tableWidth - fieldSelectorWidth - controlsWidth, 0)}
          height={height}
          onDisplayedRowIndicesChange={setDisplayedRowIndices}
          onSortByChange={(sortBy) => onSortByChange(sortBy, { onOptionsChange, options })}
          onColumnResize={(displayName, resizedWidth, fieldScope) =>
            onColumnResize(displayName, resizedWidth, fieldScope, { fieldConfig, onFieldConfigChange })
          }
          onCellFilterAdded={panelContext.onAddAdHocFilter}
          enableSharedCrosshair={enableSharedCrosshair}
          fieldConfig={fieldConfig}
          getActions={getActions}
          structureRev={data.structureRev}
          transparent={transparent}
        />
      </div>
    </>
  );
}

const getStyles = (
  theme: GrafanaTheme2,
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
    shortcut: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      color: theme.colors.text.secondary,
      opacity: 0.7,
      fontSize: theme.typography.bodySmall.fontSize,
      marginTop: theme.spacing(1),
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
