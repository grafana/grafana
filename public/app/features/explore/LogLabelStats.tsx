import React, { PureComponent } from 'react';
import classnames from 'classnames';
import { LogLabelStatsModel } from '@grafana/ui';

function LogLabelStatsRow(logLabelStatsModel: LogLabelStatsModel) {
  const { active, count, proportion, value } = logLabelStatsModel;
  const percent = `${Math.round(proportion * 100)}%`;
  const barStyle = { width: percent };
  const className = classnames('logs-stats-row', { 'logs-stats-row--active': active });

  return (
    <div className={className}>
      <div className="logs-stats-row__label">
        <div className="logs-stats-row__value" title={value}>
          {value}
        </div>
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

interface Props {
  stats: LogLabelStatsModel[];
  label: string;
  value: string;
  rowCount: number;
  onClickClose: () => void;
}

export class LogLabelStats extends PureComponent<Props> {
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
      <div className="logs-stats">
        <div className="logs-stats__header">
          <span className="logs-stats__title">
            {label}: {total} of {rowCount} rows have that label
          </span>
          <span className="logs-stats__close fa fa-remove" onClick={onClickClose} />
        </div>
        <div className="logs-stats__body">
          {topRows.map(stat => (
            <LogLabelStatsRow key={stat.value} {...stat} active={stat.value === value} />
          ))}
          {insertActiveRow && activeRow && <LogLabelStatsRow key={activeRow.value} {...activeRow} active />}
          {otherCount > 0 && (
            <LogLabelStatsRow key="__OTHERS__" count={otherCount} value="Other" proportion={otherProportion} />
          )}
        </div>
      </div>
    );
  }
}
