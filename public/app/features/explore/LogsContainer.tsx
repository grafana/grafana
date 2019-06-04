import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import {
  RawTimeRange,
  TimeRange,
  LogLevel,
  TimeZone,
  AbsoluteTimeRange,
  toUtc,
  dateTime,
  DataSourceApi,
  LogsModel,
  LogRowModel,
  LogsDedupStrategy,
  LoadingState,
} from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { changeDedupStrategy, changeTime } from './state/actions';
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
  range: TimeRange;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  toggleLogLevelAction: typeof toggleLogLevelAction;
  changeDedupStrategy: typeof changeDedupStrategy;
  dedupStrategy: LogsDedupStrategy;
  hiddenLogLevels: Set<LogLevel>;
  width: number;
  changeTime: typeof changeTime;
  isLive: boolean;
  stopLive: typeof changeRefreshIntervalAction;
}

export class LogsContainer extends PureComponent<LogsContainerProps> {
  onChangeTime = (absRange: AbsoluteTimeRange) => {
    const { exploreId, timeZone, changeTime } = this.props;
    const range = {
      from: timeZone.isUtc ? toUtc(absRange.from) : dateTime(absRange.from),
      to: timeZone.isUtc ? toUtc(absRange.to) : dateTime(absRange.to),
    };

    changeTime(exploreId, range);
  };

  onStopLive = () => {
    const { exploreId } = this.props;
    this.props.stopLive({ exploreId, refreshInterval: offOption.value });
  };

  handleDedupStrategyChange = (dedupStrategy: LogsDedupStrategy) => {
    this.props.changeDedupStrategy(this.props.exploreId, dedupStrategy);
  };

  hangleToggleLogLevel = (hiddenLogLevels: Set<LogLevel>) => {
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
      range,
      timeZone,
      scanning,
      scanRange,
      width,
      hiddenLogLevels,
      isLive,
    } = this.props;

    if (isLive) {
      return (
        <Panel label="Logs" loading={false} isOpen>
          <LiveLogsWithTheme logsResult={logsResult} stopLive={this.onStopLive} />
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
          onToggleLogLevel={this.hangleToggleLogLevel}
          range={range}
          timeZone={timeZone}
          scanning={scanning}
          scanRange={scanRange}
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
    scanRange,
    range,
    datasourceInstance,
    isLive,
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
    scanRange,
    range,
    timeZone,
    dedupStrategy,
    hiddenLogLevels,
    dedupedResult,
    datasourceInstance,
    isLive,
  };
}

const mapDispatchToProps = {
  changeDedupStrategy,
  toggleLogLevelAction,
  changeTime,
  stopLive: changeRefreshIntervalAction,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LogsContainer)
);
