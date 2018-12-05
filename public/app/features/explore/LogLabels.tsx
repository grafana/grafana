import _ from 'lodash';
import React, { PureComponent } from 'react';
import classnames from 'classnames';

import { calculateLogsLabelStats, LogsLabelStat, LogsStreamLabels, LogRow } from 'app/core/logs_model';

function StatsRow({ active, count, proportion, value }: LogsLabelStat) {
  const percent = `${Math.round(proportion * 100)}%`;
  const barStyle = { width: percent };
  const className = classnames('logs-stats-row', { 'logs-stats-row--active': active });

  return (
    <div className={className}>
      <div className="logs-stats-row__label">
        <div className="logs-stats-row__value">{value}</div>
        <div className="logs-stats-row__count">{count}</div>
        <div className="logs-stats-row__percent">{percent}</div>
      </div>
      <div className="logs-stats-row__bar">
        <div className="logs-stats-row__innerbar" style={barStyle} />
      </div>
    </div>
  );
}

const STATS_ROW_LIMIT = 5;
class Stats extends PureComponent<{
  stats: LogsLabelStat[];
  label: string;
  value: string;
  rowCount: number;
  onClickClose: () => void;
}> {
  render() {
    const { label, rowCount, stats, value, onClickClose } = this.props;
    const topRows = stats.slice(0, STATS_ROW_LIMIT);
    let activeRow = topRows.find(row => row.value === value);
    let otherRows = stats.slice(STATS_ROW_LIMIT);
    const insertActiveRow = !activeRow;
    // Remove active row from other to show extra
    if (insertActiveRow) {
      activeRow = otherRows.find(row => row.value === value);
      otherRows = otherRows.filter(row => row.value !== value);
    }
    const otherCount = otherRows.reduce((sum, row) => sum + row.count, 0);
    const topCount = topRows.reduce((sum, row) => sum + row.count, 0);
    const total = topCount + otherCount;
    const otherProportion = otherCount / total;

    return (
      <>
        <div className="logs-stats__info">
          {label}: {total} of {rowCount} rows have that label
          <span className="logs-stats__icon fa fa-window-close" onClick={onClickClose} />
        </div>
        {topRows.map(stat => <StatsRow key={stat.value} {...stat} active={stat.value === value} />)}
        {insertActiveRow && <StatsRow key={activeRow.value} {...activeRow} active />}
        {otherCount > 0 && <StatsRow key="__OTHERS__" count={otherCount} value="Other" proportion={otherProportion} />}
      </>
    );
  }
}

class Label extends PureComponent<
  {
    allRows?: LogRow[];
    label: string;
    plain?: boolean;
    value: string;
    onClickLabel?: (label: string, value: string) => void;
  },
  { showStats: boolean; stats: LogsLabelStat[] }
> {
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
      const stats = calculateLogsLabelStats(this.props.allRows, this.props.label);
      return { showStats: true, stats };
    });
  };

  render() {
    const { allRows, label, plain, value } = this.props;
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
        {!plain && allRows && <span onClick={this.onClickStats} className="logs-label__icon fa fa-signal" />}
        {showStats && (
          <span className="logs-label__stats">
            <Stats
              stats={stats}
              rowCount={allRows.length}
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

export default class LogLabels extends PureComponent<{
  allRows?: LogRow[];
  labels: LogsStreamLabels;
  plain?: boolean;
  onClickLabel?: (label: string, value: string) => void;
}> {
  render() {
    const { allRows, labels, onClickLabel, plain } = this.props;
    return Object.keys(labels).map(key => (
      <Label key={key} allRows={allRows} label={key} value={labels[key]} plain={plain} onClickLabel={onClickLabel} />
    ));
  }
}
