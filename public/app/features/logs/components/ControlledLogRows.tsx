import { css } from '@emotion/css';
import { useRef } from 'react';

import { AbsoluteTimeRange, CoreApp, EventBus, EventBusSrv, LogsSortOrder, TimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';

import { InfiniteScroll } from './InfiniteScroll';
import { LogRows, Props } from './LogRows';
import { LogListContextProvider, useLogListContext } from './panel/LogListContext';
import { LogListControls } from './panel/LogListControls';

interface ControlledLogRowsProps extends Omit<Props, 'scrollElement'> {
  eventBus?: EventBus;
  loading: boolean;
  loadMoreLogs?: (range: AbsoluteTimeRange) => void;
  range: TimeRange;
}

type LogRowsComponentProps = Omit<
  ControlledLogRowsProps,
  'app' | 'dedupStrategy' | 'showTime' | 'logsSortOrder' | 'wrapLogMessage'
>;

export const ControlledLogRows = ({
  eventBus = new EventBusSrv(),
  dedupStrategy,
  showTime,
  logsSortOrder,
  wrapLogMessage,
  ...rest
}: ControlledLogRowsProps) => {
  return (
    <LogListContextProvider
      app={rest.app || CoreApp.Unknown}
      displayedFields={[]}
      dedupStrategy={dedupStrategy}
      showControls
      showTime={showTime}
      sortOrder={logsSortOrder || LogsSortOrder.Descending}
      wrapLogMessage={wrapLogMessage}
    >
      <LogRowsComponent {...rest} eventBus={eventBus} />
    </LogListContextProvider>
  );
};

const LogRowsComponent = ({ eventBus, loading, loadMoreLogs, range, ...rest }: LogRowsComponentProps) => {
  const { app, dedupStrategy, showTime, sortOrder, wrapLogMessage } = useLogListContext();
  const scrollElementRef = useRef<HTMLDivElement | null>(null);

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
