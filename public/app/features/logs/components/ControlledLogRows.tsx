import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';

import {
  AbsoluteTimeRange,
  CoreApp,
  DataFrame,
  EventBusSrv,
  ExploreLogsPanelState,
  LogsMetaItem,
  LogsSortOrder,
  SplitOpen,
  TimeRange,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { LogsVisualisationType } from '../../explore/Logs/Logs';

import { ControlledLogsTable } from './ControlledLogsTable';
import { InfiniteScroll } from './InfiniteScroll';
import { LogRows, Props } from './LogRows';
import { LogListControlOptions } from './panel/LogList';
import { LogListContextProvider, useLogListContext } from './panel/LogListContext';
import { LogListControls } from './panel/LogListControls';
import { ScrollToLogsEvent } from './panel/virtualization';

export interface ControlledLogRowsProps extends Omit<Props, 'scrollElement'> {
  hasUnescapedContent?: boolean;
  loading: boolean;
  logsMeta?: LogsMetaItem[];
  loadMoreLogs?: (range: AbsoluteTimeRange) => void;
  logOptionsStorageKey?: string;
  onLogOptionsChange?: (option: keyof LogListControlOptions, value: string | boolean | string[]) => void;
  range: TimeRange;

  /** Props added for Table **/
  visualisationType: LogsVisualisationType;
  splitOpen?: SplitOpen;
  panelState?: ExploreLogsPanelState;
  updatePanelState?: (panelState: Partial<ExploreLogsPanelState>) => void;
  datasourceType?: string;
  width?: number;
  logsTableFrames?: DataFrame[];
}

export type LogRowsComponentProps = Omit<
  ControlledLogRowsProps,
  'app' | 'dedupStrategy' | 'showLabels' | 'showTime' | 'logsSortOrder' | 'prettifyLogMessage' | 'wrapLogMessage'
>;

export const ControlledLogRows = forwardRef<HTMLDivElement | null, ControlledLogRowsProps>(
  (
    {
      deduplicatedRows,
      dedupStrategy,
      hasUnescapedContent,
      showLabels,
      showTime,
      logsMeta,
      logOptionsStorageKey,
      logsSortOrder,
      prettifyLogMessage,
      onLogOptionsChange,
      wrapLogMessage,
      ...rest
    }: ControlledLogRowsProps,
    ref
  ) => {
    return (
      <LogListContextProvider
        app={rest.app || CoreApp.Unknown}
        displayedFields={[]}
        dedupStrategy={dedupStrategy}
        hasUnescapedContent={hasUnescapedContent}
        logOptionsStorageKey={logOptionsStorageKey}
        logs={deduplicatedRows ?? []}
        logsMeta={logsMeta}
        prettifyJSON={prettifyLogMessage}
        showControls
        showTime={showTime}
        showUniqueLabels={showLabels}
        sortOrder={logsSortOrder || LogsSortOrder.Descending}
        onLogOptionsChange={onLogOptionsChange}
        wrapLogMessage={wrapLogMessage}
      >
        {rest.visualisationType === 'logs' && (
          <LogRowsComponent ref={ref} {...rest} deduplicatedRows={deduplicatedRows} />
        )}
        {rest.visualisationType === 'table' && rest.panelState && rest.updatePanelState && (
          <ControlledLogsTable {...rest} />
        )}
      </LogListContextProvider>
    );
  }
);

ControlledLogRows.displayName = 'ControlledLogRows';

const LogRowsComponent = forwardRef<HTMLDivElement | null, LogRowsComponentProps>(
  ({ loading, loadMoreLogs, deduplicatedRows = [], range, ...rest }: LogRowsComponentProps, ref) => {
    const {
      app,
      dedupStrategy,
      filterLevels,
      forceEscape,
      prettifyJSON,
      sortOrder,
      showTime,
      showUniqueLabels,
      wrapLogMessage,
    } = useLogListContext();
    const eventBus = useMemo(() => new EventBusSrv(), []);
    const scrollElementRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const subscription = eventBus.subscribe(ScrollToLogsEvent, (e: ScrollToLogsEvent) =>
        handleScrollToEvent(e, scrollElementRef.current)
      );
      return () => subscription.unsubscribe();
    }, [eventBus]);

    useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(ref, () => scrollElementRef.current);

    const filteredLogs = useMemo(
      () =>
        filterLevels.length === 0
          ? deduplicatedRows
          : deduplicatedRows.filter((log) => filterLevels.includes(log.logLevel)),
      [filterLevels, deduplicatedRows]
    );

    const scrollElementClassName = useMemo(() => {
      if (ref) {
        return styles.forwardedScrollableLogRows;
      }
      return config.featureToggles.logsInfiniteScrolling ? styles.scrollableLogRows : styles.logRows;
    }, [ref]);

    return (
      <div className={styles.logRowsContainer}>
        <LogListControls eventBus={eventBus} />
        <div ref={scrollElementRef} className={scrollElementClassName}>
          <InfiniteScroll
            loading={loading}
            loadMoreLogs={loadMoreLogs}
            range={range}
            timeZone={rest.timeZone}
            rows={filteredLogs}
            scrollElement={scrollElementRef.current}
            sortOrder={sortOrder}
          >
            <LogRows
              {...rest}
              app={app}
              dedupStrategy={dedupStrategy}
              deduplicatedRows={filteredLogs}
              forceEscape={forceEscape}
              logRows={filteredLogs}
              logsSortOrder={sortOrder}
              scrollElement={scrollElementRef.current}
              prettifyLogMessage={Boolean(prettifyJSON)}
              showLabels={Boolean(showUniqueLabels)}
              showTime={showTime}
              wrapLogMessage={wrapLogMessage}
            />
          </InfiniteScroll>
        </div>
      </div>
    );
  }
);

LogRowsComponent.displayName = 'LogRowsComponent';

function handleScrollToEvent(event: ScrollToLogsEvent, scrollElement: HTMLDivElement | null) {
  if (event.payload.scrollTo === 'top') {
    scrollElement?.scrollTo(0, 0);
  } else if (scrollElement) {
    scrollElement.scrollTo(0, scrollElement.scrollHeight);
  }
}

const styles = {
  scrollableLogRows: css({
    overflowY: 'auto',
    width: '100%',
    maxHeight: '80vh',
  }),
  forwardedScrollableLogRows: css({
    overflowY: 'auto',
    width: '100%',
    maxHeight: '100%',
  }),
  logRows: css({
    overflowX: 'scroll',
    overflowY: 'visible',
    width: '100%',
  }),
  logRowsContainer: css({
    display: 'flex',
    flexDirection: 'row-reverse',
    height: '100%',
  }),
};
