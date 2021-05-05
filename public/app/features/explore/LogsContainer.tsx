import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, ConnectedProps } from 'react-redux';
import { isEqual } from 'lodash';
import LRU from 'lru-cache';
import { Collapse } from '@grafana/ui';
import { AbsoluteTimeRange, Field, LogRowModel, LogsModel, RawTimeRange } from '@grafana/data';
import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';
import { splitOpen } from './state/main';
import { updateTimeRange } from './state/time';
import { getTimeZone } from '../profile/state/selectors';
import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { LogsCrossFadeTransition } from './utils/LogsCrossFadeTransition';
import { LiveTailControls } from './useLiveTailControls';
import { getFieldLinksForExplore } from './utils/links';

export interface LogsContainerProps extends PropsFromRedux {
  exploreId: ExploreId;
  scanRange?: RawTimeRange;
  width: number;
  syncedTimes: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
}

type LogsContainerState = {
  logsToShow: LogsModel | null;
  absoluteRangeToShow: AbsoluteTimeRange;
};
export class LogsContainer extends PureComponent<LogsContainerProps, LogsContainerState> {
  private logRowsCache = new LRU<string, { cacheLogsResult: LogsModel; cacheAbsoluteRange: AbsoluteTimeRange }>(5);

  constructor(props: LogsContainerProps) {
    super(props);

    this.state = {
      logsToShow: props.logsResult,
      absoluteRangeToShow: props.absoluteRange,
    };
  }

  componentDidMount() {
    const { logsResult, absoluteRange } = this.props;
    if (logsResult && absoluteRange) {
      this.setCacheLogResults(logsResult, absoluteRange);
    }
  }

  componentDidUpdate(prevProps: LogsContainerProps) {
    const { logsResult, absoluteRange } = this.props;
    // If new results, update cache
    if (logsResult && !isEqual(logsResult, prevProps.logsResult)) {
      // If queries were changed, reset cache and start fresh
      if (!isEqual(logsResult.queries, prevProps.logsResult?.queries)) {
        this.logRowsCache.reset();
      }
      // Update state and add to logResults and absolutRange to chache
      this.setState({ logsToShow: this.props.logsResult, absoluteRangeToShow: this.props.absoluteRange });
      this.setCacheLogResults(logsResult, absoluteRange);
    }
  }

  setCacheLogResults(logsResult: LogsModel, absoluteRange: AbsoluteTimeRange) {
    const cacheKey = this.createCacheKey(absoluteRange);
    this.logRowsCache.set(cacheKey, { cacheLogsResult: logsResult, cacheAbsoluteRange: absoluteRange });
  }

  getCacheLogResults(absoluteRange: AbsoluteTimeRange) {
    const cacheKey = this.createCacheKey(absoluteRange);
    const { cacheLogsResult, cacheAbsoluteRange } = this.logRowsCache.get(cacheKey) || {};
    return { cacheLogsResult, cacheAbsoluteRange };
  }

  createCacheKey(absRange: AbsoluteTimeRange) {
    const params = {
      from: absRange.from,
      to: absRange.to,
    };

    const cacheKey = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v.toString())}`)
      .join('&');
    return cacheKey;
  }

  onChangeTime = (absoluteRange: AbsoluteTimeRange, checkForCaching?: boolean) => {
    const { exploreId, updateTimeRange } = this.props;
    if (!checkForCaching) {
      updateTimeRange({ exploreId, absoluteRange });
    } else {
      const { cacheAbsoluteRange, cacheLogsResult } = this.getCacheLogResults(absoluteRange);
      if (!cacheAbsoluteRange || !cacheLogsResult) {
        updateTimeRange({ exploreId, absoluteRange });
      } else {
        this.setState({ logsToShow: cacheLogsResult, absoluteRangeToShow: cacheAbsoluteRange });
      }
    }
  };

  getLogRowContext = async (row: LogRowModel, options?: any): Promise<any> => {
    const { datasourceInstance } = this.props;

    if (datasourceInstance?.getLogRowContext) {
      return datasourceInstance.getLogRowContext(row, options);
    }

    return [];
  };

  showContextToggle = (row?: LogRowModel): boolean => {
    const { datasourceInstance } = this.props;

    if (datasourceInstance?.showContextToggle) {
      return datasourceInstance.showContextToggle(row);
    }

    return false;
  };

  getFieldLinks = (field: Field, rowIndex: number) => {
    const { splitOpen: splitOpenFn, range } = this.props;
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn, range });
  };

  render() {
    const {
      loading,
      logsHighlighterExpressions,
      onClickFilterLabel,
      onClickFilterOutLabel,
      onStartScanning,
      onStopScanning,
      timeZone,
      scanning,
      range,
      width,
      isLive,
      exploreId,
    } = this.props;

    const { logsToShow, absoluteRangeToShow } = this.state;

    const { rows: logRows, meta: logsMeta, series: logsSeries, queries: logsQueries, visibleRange } = logsToShow || {};

    if (!logRows) {
      return null;
    }

    return (
      <>
        <LogsCrossFadeTransition visible={isLive}>
          <Collapse label="Logs" loading={false} isOpen>
            <LiveTailControls exploreId={exploreId}>
              {(controls) => (
                <LiveLogsWithTheme
                  logRows={logRows}
                  timeZone={timeZone}
                  stopLive={controls.stop}
                  isPaused={this.props.isPaused}
                  onPause={controls.pause}
                  onResume={controls.resume}
                />
              )}
            </LiveTailControls>
          </Collapse>
        </LogsCrossFadeTransition>
        <LogsCrossFadeTransition visible={!isLive}>
          <Collapse label="Logs" loading={loading} isOpen>
            <Logs
              logRows={logRows}
              logsMeta={logsMeta}
              logsSeries={logsSeries}
              logsQueries={logsQueries}
              highlighterExpressions={logsHighlighterExpressions}
              loading={loading}
              onChangeTime={this.onChangeTime}
              onClickFilterLabel={onClickFilterLabel}
              onClickFilterOutLabel={onClickFilterOutLabel}
              onStartScanning={onStartScanning}
              onStopScanning={onStopScanning}
              absoluteRange={absoluteRangeToShow}
              visibleRange={visibleRange}
              timeZone={timeZone}
              scanning={scanning}
              scanRange={range.raw}
              showContextToggle={this.showContextToggle}
              width={width}
              getRowContext={this.getLogRowContext}
              getFieldLinks={this.getFieldLinks}
            />
          </Collapse>
        </LogsCrossFadeTransition>
      </>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: string }) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const {
    logsHighlighterExpressions,
    logsResult,
    loading,
    scanning,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
  } = item;
  const timeZone = getTimeZone(state.user);

  return {
    loading,
    logsHighlighterExpressions,
    logsResult,
    scanning,
    timeZone,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
  };
}

const mapDispatchToProps = {
  updateTimeRange,
  splitOpen,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

export default hot(module)(connector(LogsContainer));
