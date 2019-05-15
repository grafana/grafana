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
} from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { LogsModel, LogsDedupStrategy, LogRowModel } from 'app/core/logs_model';
import { StoreState } from 'app/types';

import { changeDedupStrategy, changeTime } from './state/actions';
import Logs from './Logs';
import Panel from './Panel';
import { toggleLogLevelAction } from 'app/features/explore/state/actionTypes';
import { deduplicatedLogsSelector, exploreItemUIStateSelector } from 'app/features/explore/state/selectors';
import { getTimeZone } from '../profile/state/selectors';

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
}

export class LogsContainer extends PureComponent<LogsContainerProps> {
  private liveEndDiv: HTMLDivElement = null;
  private freshRows: LogRowModel[] = [];
  private oldRows: LogRowModel[] = [];

  onChangeTime = (absRange: AbsoluteTimeRange) => {
    const { exploreId, timeZone, changeTime } = this.props;
    const range = {
      from: timeZone.isUtc ? toUtc(absRange.from) : dateTime(absRange.from),
      to: timeZone.isUtc ? toUtc(absRange.to) : dateTime(absRange.to),
    };

    changeTime(exploreId, range);
  };

  componentDidUpdate(prevProps: LogsContainerProps) {
    const prevRows: LogRowModel[] = prevProps.logsResult ? prevProps.logsResult.rows : [];
    const rows: LogRowModel[] = this.props.logsResult ? this.props.logsResult.rows : [];
    if (prevRows !== rows && this.props.isLive && this.liveEndDiv) {
      this.liveEndDiv.scrollIntoView(false);
      this.freshRows = rows.filter(row => !prevRows.includes(row)).sort((a, b) => a.timeEpochMs - b.timeEpochMs);
      this.oldRows = prevRows.sort((a, b) => a.timeEpochMs - b.timeEpochMs);
    }

    if (prevRows === rows) {
      this.freshRows = [];
      this.oldRows = prevRows.sort((a, b) => a.timeEpochMs - b.timeEpochMs);
    }
  }

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

  getLogRowContext = async (row: LogRowModel, limit: number) => {
    const { datasourceInstance } = this.props;

    if (datasourceInstance) {
      return datasourceInstance.getLogRowContext(row, limit);
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
        <div className="logs-rows live">
          {this.oldRows.map((row, index) => {
            return (
              <div className="logs-row old" key={`${row.timeEpochMs}-${index}`}>
                <div className="logs-row__localtime" title={`${row.timestamp} (${row.timeFromNow})`}>
                  {row.timeLocal}
                </div>
                <div className="logs-row__message">{row.entry}</div>
              </div>
            );
          })}
          {this.freshRows.map((row, index) => {
            return (
              <div className="logs-row fresh" key={`${row.timeEpochMs}-${index}`}>
                <div className="logs-row__localtime" title={`${row.timestamp} (${row.timeFromNow})`}>
                  {row.timeLocal}
                </div>
                <div className="logs-row__message">{row.entry}</div>
              </div>
            );
          })}
          <div ref={element => (this.liveEndDiv = element)} />
        </div>
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
  const { logsHighlighterExpressions, logsResult, logIsLoading, scanning, scanRange, range, datasourceInstance, isLive } = item;
  const loading = logIsLoading;
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
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LogsContainer)
);
