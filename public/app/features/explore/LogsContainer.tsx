import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { DataSourceApi, Collapse, RefreshPicker } from '@grafana/ui';

import {
  RawTimeRange,
  LogLevel,
  TimeZone,
  AbsoluteTimeRange,
  LogsModel,
  LogRowModel,
  LogsDedupStrategy,
  TimeRange,
} from '@grafana/data';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { changeDedupStrategy, updateTimeRange } from './state/actions';
import {
  toggleLogLevelAction,
  changeRefreshIntervalAction,
  setPausedStateAction,
} from 'app/features/explore/state/actionTypes';
import { deduplicatedLogsSelector, exploreItemUIStateSelector } from 'app/features/explore/state/selectors';
import { getTimeZone } from '../profile/state/selectors';
import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';

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
  width: number;
  isLive: boolean;
  stopLive: typeof changeRefreshIntervalAction;
  updateTimeRange: typeof updateTimeRange;
  range: TimeRange;
  absoluteRange: AbsoluteTimeRange;
  setPausedStateAction: typeof setPausedStateAction;
  isPaused: boolean;
}

export class LogsContainer extends PureComponent<LogsContainerProps> {
  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;

    updateTimeRange({ exploreId, absoluteRange });
  };

  onStopLive = () => {
    const { exploreId } = this.props;
    this.props.stopLive({ exploreId, refreshInterval: RefreshPicker.offOption.value });
  };

  onPause = () => {
    const { exploreId } = this.props;
    this.props.setPausedStateAction({ exploreId, isPaused: true });
  };

  onResume = () => {
    const { exploreId } = this.props;
    this.props.setPausedStateAction({ exploreId, isPaused: false });
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

  getLogRowContext = async (row: LogRowModel, options?: any): Promise<any> => {
    const { datasourceInstance } = this.props;

    if (datasourceInstance) {
      return datasourceInstance.getLogRowContext(row, options);
    }

    return [];
  };

  render() {
    const {
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
      isLive,
    } = this.props;

    if (isLive) {
      return (
        <Collapse label="Logs" loading={false} isOpen>
          <LiveLogsWithTheme
            logsResult={logsResult}
            timeZone={timeZone}
            stopLive={this.onStopLive}
            isPaused={this.props.isPaused}
            onPause={this.onPause}
            onResume={this.onResume}
          />
        </Collapse>
      );
    }

    return (
      <Collapse label="Logs" loading={loading} isOpen>
        <Logs
          dedupStrategy={this.props.dedupStrategy || LogsDedupStrategy.none}
          data={logsResult}
          dedupedData={dedupedResult}
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
          getRowContext={this.getLogRowContext}
        />
      </Collapse>
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
  const { dedupStrategy } = exploreItemUIStateSelector(item);
  const dedupedResult = deduplicatedLogsSelector(item);
  const timeZone = getTimeZone(state.user);

  return {
    loading,
    logsHighlighterExpressions,
    logsResult,
    scanning,
    timeZone,
    dedupStrategy,
    dedupedResult,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
  };
}

const mapDispatchToProps = {
  changeDedupStrategy,
  toggleLogLevelAction,
  stopLive: changeRefreshIntervalAction,
  updateTimeRange,
  setPausedStateAction,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LogsContainer)
);
