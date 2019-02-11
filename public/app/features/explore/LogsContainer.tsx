import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { RawTimeRange, TimeRange } from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { LogsModel } from 'app/core/logs_model';
import { StoreState } from 'app/types';

import { toggleLogs } from './state/actions';
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
  width: number;
}

export class LogsContainer extends PureComponent<LogsContainerProps> {
  onClickLogsButton = () => {
    this.props.toggleLogs(this.props.exploreId);
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
          data={logsResult}
          exploreId={exploreId}
          key={logsResult && logsResult.id}
          highlighterExpressions={logsHighlighterExpressions}
          loading={loading}
          onChangeTime={onChangeTime}
          onClickLabel={onClickLabel}
          onStartScanning={onStartScanning}
          onStopScanning={onStopScanning}
          range={range}
          scanning={scanning}
          scanRange={scanRange}
          width={width}
        />
      </Panel>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const { logsHighlighterExpressions, logsResult, queryTransactions, scanning, scanRange, showingLogs, range } = item;
  const loading = queryTransactions.some(qt => qt.resultType === 'Logs' && !qt.done);
  return {
    loading,
    logsHighlighterExpressions,
    logsResult,
    scanning,
    scanRange,
    showingLogs,
    range,
  };
}

const mapDispatchToProps = {
  toggleLogs,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(LogsContainer));
