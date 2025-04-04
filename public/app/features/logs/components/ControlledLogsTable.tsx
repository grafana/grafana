import { css } from '@emotion/css';
import { useEffect, useMemo, useRef } from 'react';

import { EventBusSrv, GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { LogsTableWrap } from '../../explore/Logs/LogsTableWrap';

import { LogRowsComponentProps } from './ControlledLogRows';
import { useLogListContext } from './panel/LogListContext';
import { LogListControls } from './panel/LogListControls';
import { ScrollToLogsEvent } from './panel/virtualization';

export const ControlledLogsTable = ({
  loading,
  loadMoreLogs,
  deduplicatedRows = [],
  range,
  splitOpen,
  onClickFilterLabel,
  onClickFilterOutLabel,
  panelState,
  datasourceType,
  updatePanelState,
  width,
  logsTableFrames,
  ...rest
}: LogRowsComponentProps) => {
  const { sortOrder } = useLogListContext();
  const eventBus = useMemo(() => new EventBusSrv(), []);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const subscription = eventBus.subscribe(ScrollToLogsEvent, (e: ScrollToLogsEvent) =>
      handleScrollToEvent(e, scrollElementRef.current)
    );
    return () => subscription.unsubscribe();
  }, [eventBus]);

  // const filteredLogs = useMemo(
  //   () =>
  //     filterLevels.length === 0
  //       ? deduplicatedRows
  //       : deduplicatedRows.filter((log) => filterLevels.includes(log.logLevel)),
  //   [filterLevels, deduplicatedRows]
  // );

  const theme = useTheme2();
  const styles = getStyles(theme);
  //
  // let refIds = new Set<string>();
  // let dataFrameFromLogsFrame: DataFrame[] = []
  //
  // // get all unqiue dataframes by refId from logsFrame
  // filteredLogs.forEach(logRow => {
  //   if(logRow.dataFrame.refId && !refIds.has(logRow.dataFrame.refId)){
  //     dataFrameFromLogsFrame.push(logRow.dataFrame)
  //     refIds.add(logRow.dataFrame.refId)
  //   }
  // })

  return (
    <div className={styles.logRowsContainer}>
      <div ref={scrollElementRef} className={styles.logRows} data-testid="logRowsTable">
        {/* Width should be full width minus logs navigation and padding */}
        <LogsTableWrap
          logsSortOrder={sortOrder}
          range={range}
          splitOpen={splitOpen}
          timeZone={rest.timeZone}
          width={width - 45}
          logsFrames={logsTableFrames ?? []}
          onClickFilterLabel={onClickFilterLabel}
          onClickFilterOutLabel={onClickFilterOutLabel}
          panelState={panelState}
          theme={theme}
          updatePanelState={updatePanelState}
          datasourceType={datasourceType}
        />
      </div>
      <LogListControls eventBus={eventBus} />
    </div>
  );
};

function handleScrollToEvent(event: ScrollToLogsEvent, scrollElement: HTMLDivElement | null) {
  if (event.payload.scrollTo === 'top') {
    scrollElement?.scrollTo(0, 0);
  } else if (scrollElement) {
    scrollElement.scrollTo(0, scrollElement.scrollHeight);
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    logRows: css({
      overflowY: 'visible',
      width: '100%',
    }),
    logRowsContainer: css({
      display: 'flex',
    }),
  };
};
