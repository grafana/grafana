import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { RawTimeRange, TimeRange } from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { LogsModel, LogsDedupStrategy } from 'app/core/logs_model';
import { StoreState } from 'app/types';

import { toggleLogs, changeDedupStrategy } from './state/actions';
import Logs from './Logs';
import Panel from './Panel';

interface LogsContainerProps {
  exploreId: ExploreId;
  loading: boolean;
  logsHighlighterExpressions?: string[];
  logsResult?: LogsModel;
  onChangeTime: (range: TimeRange) => void;
  onClickLabel: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
  range: RawTimeRange;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  showingLogs: boolean;
  toggleLogs: typeof toggleLogs;
  changeDedupStrategy: typeof changeDedupStrategy;
  dedupStrategy: LogsDedupStrategy;
  width: number;
}

export class LogsContainer extends PureComponent<LogsContainerProps> {
  onClickLogsButton = () => {
    this.props.toggleLogs(this.props.exploreId, this.props.showingLogs);
  };

  handleDedupStrategyChange = (dedupStrategy: LogsDedupStrategy) => {
    this.props.changeDedupStrategy(this.props.exploreId, dedupStrategy);
  };

  render() {
    const {
      exploreId,
      loading,
      logsHighlighterExpressions,
      logsResult,
      onChangeTime,
      onClickLabel,
      onStartScanning,
      onStopScanning,
      range,
      showingLogs,
      scanning,
      scanRange,
      width,
    } = this.props;

    return (
      <Panel label="Logs" loading={loading} isOpen={showingLogs} onToggle={this.onClickLogsButton}>
        <Logs
          dedupStrategy={this.props.dedupStrategy || LogsDedupStrategy.none}
          data={logsResult}
          exploreId={exploreId}
          key={logsResult && logsResult.id}
          highlighterExpressions={logsHighlighterExpressions}
          loading={loading}
          onChangeTime={onChangeTime}
          onClickLabel={onClickLabel}
          onStartScanning={onStartScanning}
          onStopScanning={onStopScanning}
          onDedupStrategyChange={this.handleDedupStrategyChange}
          range={range}
          scanning={scanning}
          scanRange={scanRange}
          width={width}
        />
      </Panel>
    );
  }
}

const selectItemUIState = (itemState: ExploreItemState) => {
  const { showingGraph, showingLogs, showingTable, showingStartPage, dedupStrategy } = itemState;
  return {
    showingGraph,
    showingLogs,
    showingTable,
    showingStartPage,
    dedupStrategy,
  };
};
function mapStateToProps(state: StoreState, { exploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const { logsHighlighterExpressions, logsResult, queryTransactions, scanning, scanRange, range } = item;
  const loading = queryTransactions.some(qt => qt.resultType === 'Logs' && !qt.done);
  const {showingLogs, dedupStrategy} = selectItemUIState(item);

  return {
    loading,
    logsHighlighterExpressions,
    logsResult,
    scanning,
    scanRange,
    showingLogs,
    range,
    dedupStrategy,
  };
}

const mapDispatchToProps = {
  toggleLogs,
  changeDedupStrategy,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(LogsContainer));
