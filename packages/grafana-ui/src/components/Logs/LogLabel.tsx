import React, { PureComponent } from 'react';
import { LogRowModel, LogLabelStatsModel, calculateLogsLabelStats } from '@grafana/data';

import { LogLabelStats } from './LogLabelStats';

interface Props {
  value: string;
  label: string;
  getRows: () => LogRowModel[];
  plain?: boolean;
  onClickLabel?: (label: string, value: string) => void;
}

interface State {
  showStats: boolean;
  stats: LogLabelStatsModel[];
}

export class LogLabel extends PureComponent<Props, State> {
  state: State = {
    stats: [],
    showStats: false,
  };

  onClickClose = () => {
    this.setState({ showStats: false });
  };

  onClickLabel = () => {
    const { onClickLabel, label, value } = this.props;
    if (onClickLabel) {
      onClickLabel(label, value);
    }
  };

  onClickStats = () => {
    this.setState(state => {
      if (state.showStats) {
        return { showStats: false, stats: [] };
      }
      const allRows = this.props.getRows();
      const stats = calculateLogsLabelStats(allRows, this.props.label);
      return { showStats: true, stats };
    });
  };

  render() {
    const { getRows, label, plain, value } = this.props;
    const { showStats, stats } = this.state;
    const tooltip = `${label}: ${value}`;
    return (
      <span className="logs-label">
        <span className="logs-label__value" title={tooltip}>
          {value}
        </span>
        {!plain && (
          <span title="Filter for label" onClick={this.onClickLabel} className="logs-label__icon fa fa-search-plus" />
        )}
        {!plain && getRows && <span onClick={this.onClickStats} className="logs-label__icon fa fa-signal" />}
        {showStats && (
          <span className="logs-label__stats">
            <LogLabelStats
              stats={stats}
              rowCount={getRows().length}
              label={label}
              value={value}
              onClickClose={this.onClickClose}
            />
          </span>
        )}
      </span>
    );
  }
}
