import { css } from '@emotion/css';
import { forwardRef, useMemo, useRef } from 'react';

import { EventBusSrv, type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { LogsTableWrap } from '../../explore/Logs/LogsTableWrap';

import { type ControlledLogRowsProps } from './ControlledLogRows';
import { useLogListContext } from './panel/LogListContext';
import { CONTROLS_WIDTH_EXPANDED, LogListControls } from './panel/LogListControls';
import { LOG_LIST_CONTROLS_WIDTH } from './panel/virtualization';

type Props = Omit<
  ControlledLogRowsProps,
  | 'dedupStrategy'
  | 'filterLevels'
  | 'logOptionsStorageKey'
  | 'logsMeta'
  | 'logsSortOrder'
  | 'onLogOptionsChange'
  | 'prettifyLogMessage'
  | 'showLabels'
  | 'showTime'
  | 'wrapLogMessage'
>;

export const ControlledLogsTable = forwardRef<HTMLDivElement | null, Props>(
  (
    {
      onClickFilterLabel,
      onClickFilterOutLabel,
      panelState,
      datasourceType,
      updatePanelState,
      width,
      logsTableFrames,
      visualisationType,
      displayedFields,
      exploreId,
      absoluteRange,
      logRows,
      range,
      splitOpen,
      timeZone,
    },
    ref
  ) => {
    const { sortOrder, controlsExpanded } = useLogListContext();
    const eventBus = useMemo(() => new EventBusSrv(), []);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const styles = useStyles2(getStyles);

    const tableWidthExpandedControls = width - (CONTROLS_WIDTH_EXPANDED + 12);
    const tableWidth = width - (LOG_LIST_CONTROLS_WIDTH + 12);

    return (
      <div
        ref={(element) => {
          containerRef.current = element;
          if (typeof ref === 'function') {
            ref(element);
          } else if (ref) {
            ref.current = element;
          }
        }}
        className={styles.logRowsContainer}
      >
        <LogListControls eventBus={eventBus} visualisationType={visualisationType} />
        <div className={styles.logRows} data-testid="logRowsTable">
          <LogsTableWrap
            logsSortOrder={sortOrder}
            range={range}
            splitOpen={splitOpen}
            timeZone={timeZone}
            width={controlsExpanded ? tableWidthExpandedControls : tableWidth}
            logsFrames={logsTableFrames ?? []}
            onClickFilterLabel={onClickFilterLabel}
            onClickFilterOutLabel={onClickFilterOutLabel}
            panelState={panelState}
            updatePanelState={updatePanelState}
            datasourceType={datasourceType}
            displayedFields={displayedFields}
            exploreId={exploreId}
            absoluteRange={absoluteRange}
            logRows={logRows}
          />
        </div>
      </div>
    );
  }
);

ControlledLogsTable.displayName = 'ControlledLogsTable';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    logRows: css({
      overflowY: 'visible',
      width: '100%',
    }),
    logRowsContainer: css({
      display: 'flex',
      flexDirection: 'row-reverse',
    }),
  };
};
