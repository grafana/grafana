import { css } from '@emotion/css';
import { useEffect, useMemo, useRef } from 'react';

import { AbsoluteTimeRange, CoreApp, EventBusSrv, LogsSortOrder, TimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';

import { InfiniteScroll } from './InfiniteScroll';
import { LogRows, Props } from './LogRows';
import { LogListControlOptions } from './panel/LogList';
import { LogListContextProvider, useLogListContext } from './panel/LogListContext';
import { LogListControls } from './panel/LogListControls';
import { ScrollToLogsEvent } from './panel/virtualization';

interface ControlledLogRowsProps extends Omit<Props, 'scrollElement'> {
  loading: boolean;
  loadMoreLogs?: (range: AbsoluteTimeRange) => void;
  onLogOptionsChange?: (option: keyof LogListControlOptions, value: string | boolean | string[]) => void;
  range: TimeRange;
  logOptionsStorageKey?: string;
}

type LogRowsComponentProps = Omit<
  ControlledLogRowsProps,
  'app' | 'dedupStrategy' | 'showTime' | 'logsSortOrder' | 'wrapLogMessage'
>;

export const ControlledLogRows = ({
  dedupStrategy,
  showTime,
  logsSortOrder,
  onLogOptionsChange,
  logOptionsStorageKey,
  wrapLogMessage,
  ...rest
}: ControlledLogRowsProps) => {
  return (
    <LogListContextProvider
      app={rest.app || CoreApp.Unknown}
      displayedFields={[]}
      dedupStrategy={dedupStrategy}
      logOptionsStorageKey={logOptionsStorageKey}
      showControls
      showTime={showTime}
      sortOrder={logsSortOrder || LogsSortOrder.Descending}
      onLogOptionsChange={onLogOptionsChange}
      wrapLogMessage={wrapLogMessage}
    >
      <LogRowsComponent {...rest} />
    </LogListContextProvider>
  );
};

const LogRowsComponent = ({ loading, loadMoreLogs, range, ...rest }: LogRowsComponentProps) => {
  const { app, dedupStrategy, showTime, sortOrder, wrapLogMessage } = useLogListContext();
  const eventBus = useMemo(() => new EventBusSrv(), []);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const subscription = eventBus.subscribe(ScrollToLogsEvent, (e: ScrollToLogsEvent) =>
      handleScrollToEvent(e, scrollElementRef.current)
    );
    return () => subscription.unsubscribe();
  }, [eventBus]);

  return (
    <div className={styles.logRowsContainer}>
      <div
        ref={scrollElementRef}
        className={config.featureToggles.logsInfiniteScrolling ? styles.scrollableLogRows : styles.logRows}
      >
        <InfiniteScroll
          loading={loading}
          loadMoreLogs={loadMoreLogs}
          range={range}
          timeZone={rest.timeZone}
          rows={rest.logRows ?? []}
          scrollElement={scrollElementRef.current}
          sortOrder={sortOrder}
        >
          <LogRows
            {...rest}
            app={app}
            dedupStrategy={dedupStrategy}
            logsSortOrder={sortOrder}
            scrollElement={scrollElementRef.current}
            showTime={showTime}
            wrapLogMessage={wrapLogMessage}
            renderPreview
          />
          );
        </InfiniteScroll>
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

const styles = {
  scrollableLogRows: css({
    overflowY: 'scroll',
    width: '100%',
    maxHeight: '75vh',
  }),
  logRows: css({
    overflowX: 'scroll',
    overflowY: 'visible',
    width: '100%',
  }),
  logRowsContainer: css({
    display: 'flex',
  }),
};
