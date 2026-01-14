import { css } from '@emotion/css';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import {
  AbsoluteTimeRange,
  CoreApp,
  DataFrame,
  EventBusSrv,
  ExploreLogsPanelState,
  FieldConfigSource,
  LoadingState,
  LogLevel,
  LogRowModel,
  LogsMetaItem,
  LogsSortOrder,
  PanelData,
  SplitOpen,
  TimeRange,
} from '@grafana/data';
import { getAppEvents, getTemplateSrv } from '@grafana/runtime';
import { PanelContextProvider } from '@grafana/ui';
import { Options } from 'app/plugins/panel/logstable/panelcfg.gen';

import { LogsTable } from '../../../plugins/panel/logstable/LogsTable';
import { LogsVisualisationType } from '../../explore/Logs/Logs';

import { InfiniteScroll } from './InfiniteScroll';
import { LogRows, Props } from './LogRows';
import { LogListOptions } from './panel/LogList';
import { LogListContextProvider, useLogListContext } from './panel/LogListContext';
import { LogListControls } from './panel/LogListControls';
import { ScrollToLogsEvent } from './panel/virtualization';

// @todo
export const FILTER_FOR_OPERATOR = '=';
export const FILTER_OUT_OPERATOR = '!=';
export type AdHocFilterOperator = typeof FILTER_FOR_OPERATOR | typeof FILTER_OUT_OPERATOR;
export type AdHocFilterItem = { key: string; value: string; operator: AdHocFilterOperator };

export interface ControlledLogRowsProps extends Omit<Props, 'scrollElement'> {
  loading: boolean;
  logsMeta?: LogsMetaItem[];
  loadMoreLogs?: (range: AbsoluteTimeRange) => void;
  logOptionsStorageKey?: string;
  onLogOptionsChange?: (option: LogListOptions, value: string | boolean | string[]) => void;
  range: TimeRange;
  filterLevels?: LogLevel[];
  fieldConfig: FieldConfigSource;

  /** Props added for Table **/
  visualisationType: LogsVisualisationType;
  splitOpen?: SplitOpen;
  panelState?: ExploreLogsPanelState;
  updatePanelState?: (panelState: Partial<ExploreLogsPanelState>) => void;
  datasourceType?: string;
  width?: number;
  logsTableFrames?: DataFrame[];
  displayedFields?: string[];
  exploreId?: string;
  absoluteRange?: AbsoluteTimeRange;
  logRows?: LogRowModel[];
}

export type LogRowsComponentProps = Omit<
  ControlledLogRowsProps,
  | 'app'
  | 'dedupStrategy'
  | 'filterLevels'
  | 'showLabels'
  | 'showTime'
  | 'logsSortOrder'
  | 'prettifyLogMessage'
  | 'wrapLogMessage'
>;

export const ControlledLogRows = forwardRef<HTMLDivElement | null, ControlledLogRowsProps>(
  (
    {
      deduplicatedRows,
      dedupStrategy,
      filterLevels,
      showLabels,
      showTime,
      logsMeta,
      logOptionsStorageKey,
      logsSortOrder,
      prettifyLogMessage,
      onLogOptionsChange,
      wrapLogMessage,
      fieldConfig,
      ...rest
    }: ControlledLogRowsProps,
    ref
  ) => {
    const dataFrames = rest.logsTableFrames ?? [];
    const panelData: PanelData = {
      state: rest.loading ? LoadingState.Loading : LoadingState.Done,
      series: dataFrames,
      timeRange: rest.timeRange,
    };

    const eventBus = getAppEvents();

    const onCellFilterAdded = (filter: AdHocFilterItem) => {
      const { value, key, operator } = filter;
      const { onClickFilterLabel, onClickFilterOutLabel } = rest;
      if (!onClickFilterLabel || !onClickFilterOutLabel) {
        return;
      }
      if (operator === FILTER_FOR_OPERATOR) {
        onClickFilterLabel(key, value, dataFrames[0]);
      }

      if (operator === FILTER_OUT_OPERATOR) {
        onClickFilterOutLabel(key, value, dataFrames[0]);
      }
    };

    return (
      <LogListContextProvider
        app={rest.app || CoreApp.Unknown}
        displayedFields={[]}
        dedupStrategy={dedupStrategy}
        filterLevels={filterLevels}
        fontSize="default"
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
          <LogRowsComponent
            ref={ref}
            {...rest}
            deduplicatedRows={deduplicatedRows}
            fieldConfig={{ defaults: {}, overrides: [] }}
          />
        )}
        {rest.visualisationType === 'table' && rest.updatePanelState && (
          <PanelContextProvider
            value={{
              eventsScope: 'explore',
              eventBus: eventBus ?? new EventBusSrv(),
              onAddAdHocFilter: onCellFilterAdded,
            }}
          >
            <LogsTable
              id={0}
              width={rest.width ?? 0}
              data={panelData}
              options={{}}
              transparent={false}
              height={800}
              fieldConfig={fieldConfig}
              renderCounter={0}
              title={''}
              eventBus={eventBus}
              onOptionsChange={function (options: Options): void {
                console.log('onOptionsChange not implemented');
              }}
              onFieldConfigChange={function (config: FieldConfigSource): void {
                console.log('onFieldConfigChange not implemented');
              }}
              replaceVariables={getTemplateSrv().replace.bind(getTemplateSrv())}
              onChangeTimeRange={function (timeRange: AbsoluteTimeRange): void {
                console.log('onChangeTimeRange not implemented');
              }}
              {...rest}
            />
          </PanelContextProvider>
        )}
      </LogListContextProvider>
    );
  }
);

ControlledLogRows.displayName = 'ControlledLogRows';

const LogRowsComponent = forwardRef<HTMLDivElement | null, LogRowsComponentProps>(
  (
    {
      loading,
      loadMoreLogs,
      deduplicatedRows = [],
      range,
      scrollIntoView: scrollIntoViewProp,
      ...rest
    }: LogRowsComponentProps,
    ref
  ) => {
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
      return styles.scrollableLogRows;
    }, [ref]);

    const scrollIntoView = useCallback(
      (element: HTMLElement) => {
        if (scrollIntoViewProp) {
          scrollIntoViewProp(element);
          return;
        }
        if (scrollElementRef.current) {
          scrollElementRef.current.scroll({
            behavior: 'smooth',
            top: scrollElementRef.current.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
          });
        }
      },
      [scrollIntoViewProp]
    );

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
              scrollIntoView={scrollIntoView}
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
