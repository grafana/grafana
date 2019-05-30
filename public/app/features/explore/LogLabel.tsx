import React, { PureComponent } from 'react';

import { LogLabelStats } from './LogLabelStats';
import { LogRowModel, LogLabelStatsModel } from '@grafana/ui';
import { calculateLogsLabelStats } from 'app/core/logs_model';

interface Props {
  getRows?: () => LogRowModel[];
  label: string;
  plain?: boolean;
  value: string;
  onClickLabel?: (label: string, value: string) => void;
}

interface State {
  showStats: boolean;
  stats: LogLabelStatsModel[];
}

export class LogLabel extends PureComponent<Props, State> {
  state = {
    stats: null,
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
        return { showStats: false, stats: null };
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
