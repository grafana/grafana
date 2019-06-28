import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import {
  RawTimeRange,
  LogLevel,
  TimeZone,
  AbsoluteTimeRange,
  DataSourceApi,
  LogsModel,
  LogRowModel,
  LogsDedupStrategy,
  LoadingState,
  TimeRange,
} from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { changeDedupStrategy, updateTimeRange } from './state/actions';
import Logs from './Logs';
import Panel from './Panel';
import { toggleLogLevelAction, changeRefreshIntervalAction } from 'app/features/explore/state/actionTypes';
import { deduplicatedLogsSelector, exploreItemUIStateSelector } from 'app/features/explore/state/selectors';
import { getTimeZone } from '../profile/state/selectors';
import { LiveLogsWithTheme } from './LiveLogs';
import { offOption } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';

interface LogsContainerProps {
  datasourceInstance: DataSourceApi | null;
  exploreId: ExploreId;
  loading: boolean;

  logsHighlighterExpressions?: string[];
  logsResult?: LogsModel;
  dedupedResult?: LogsModel;
  onClickLabel: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  toggleLogLevelAction: typeof toggleLogLevelAction;
  changeDedupStrategy: typeof changeDedupStrategy;
  dedupStrategy: LogsDedupStrategy;
  hiddenLogLevels: Set<LogLevel>;
  width: number;
  isLive: boolean;
  stopLive: typeof changeRefreshIntervalAction;
  updateTimeRange: typeof updateTimeRange;
  range: TimeRange;
  absoluteRange: AbsoluteTimeRange;
}

export class LogsContainer extends Component<LogsContainerProps> {
  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;

    updateTimeRange({ exploreId, absoluteRange });
  };

  onStopLive = () => {
    const { exploreId } = this.props;
    this.props.stopLive({ exploreId, refreshInterval: offOption.value });
  };

  handleDedupStrategyChange = (dedupStrategy: LogsDedupStrategy) => {
    this.props.changeDedupStrategy(this.props.exploreId, dedupStrategy);
  };

  handleToggleLogLevel = (hiddenLogLevels: LogLevel[]) => {
    const { exploreId } = this.props;
    this.props.toggleLogLevelAction({
      exploreId,
      hiddenLogLevels,
    });
  };

  getLogRowContext = async (row: LogRowModel, options?: any) => {
    const { datasourceInstance } = this.props;

    if (datasourceInstance) {
      return datasourceInstance.getLogRowContext(row, options);
    }

    return [];
  };

  // Limit re-rendering to when a query is finished executing or when the deduplication strategy changes
  // for performance reasons.
  shouldComponentUpdate(nextProps: LogsContainerProps): boolean {
    return (
      nextProps.loading !== this.props.loading ||
      nextProps.dedupStrategy !== this.props.dedupStrategy ||
      nextProps.logsHighlighterExpressions !== this.props.logsHighlighterExpressions ||
      nextProps.hiddenLogLevels !== this.props.hiddenLogLevels ||
      nextProps.scanning !== this.props.scanning ||
      nextProps.isLive !== this.props.isLive
    );
  }

  render() {
    const {
      exploreId,
      loading,
      logsHighlighterExpressions,
      logsResult,
      dedupedResult,
      onClickLabel,
      onStartScanning,
      onStopScanning,
      absoluteRange,
      timeZone,
      scanning,
      range,
      width,
      hiddenLogLevels,
      isLive,
    } = this.props;

    if (isLive) {
      return (
        <Panel label="Logs" loading={false} isOpen>
          <LiveLogsWithTheme logsResult={logsResult} timeZone={timeZone} stopLive={this.onStopLive} />
        </Panel>
      );
    }

    return (
      <Panel label="Logs" loading={loading} isOpen>
        <Logs
          dedupStrategy={this.props.dedupStrategy || LogsDedupStrategy.none}
          data={logsResult}
          dedupedData={dedupedResult}
          exploreId={exploreId}
          highlighterExpressions={logsHighlighterExpressions}
          loading={loading}
          onChangeTime={this.onChangeTime}
          onClickLabel={onClickLabel}
          onStartScanning={onStartScanning}
          onStopScanning={onStopScanning}
          onDedupStrategyChange={this.handleDedupStrategyChange}
          onToggleLogLevel={this.handleToggleLogLevel}
          absoluteRange={absoluteRange}
          timeZone={timeZone}
          scanning={scanning}
          scanRange={range.raw}
          width={width}
          hiddenLogLevels={hiddenLogLevels}
          getRowContext={this.getLogRowContext}
        />
      </Panel>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const {
    logsHighlighterExpressions,
    logsResult,
    loadingState,
    scanning,
    datasourceInstance,
    isLive,
    range,
    absoluteRange,
  } = item;
  const loading = loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming;
  const { dedupStrategy } = exploreItemUIStateSelector(item);
  const hiddenLogLevels = new Set(item.hiddenLogLevels);
  const dedupedResult = deduplicatedLogsSelector(item);
  const timeZone = getTimeZone(state.user);

  return {
    loading,
    logsHighlighterExpressions,
    logsResult,
    scanning,
    timeZone,
    dedupStrategy,
    hiddenLogLevels,
    dedupedResult,
    datasourceInstance,
    isLive,
    range,
    absoluteRange,
  };
}

const mapDispatchToProps = {
  changeDedupStrategy,
  toggleLogLevelAction,
  stopLive: changeRefreshIntervalAction,
  updateTimeRange,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LogsContainer)
);
