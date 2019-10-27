import React, { PureComponent } from 'react';
import { LogRowModel, LogsParser, LogLabelStatsModel, calculateFieldStats } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

//Components
import { LogLabelStats } from './LogLabelStats';

interface Props extends Themeable {
  parsedValue: string;
  parsedKey: string;
  field?: string;
  row?: LogRowModel;
  canShowMetrics?: boolean;
  canFilter?: boolean;
  canFilterOut?: boolean;
  parser?: LogsParser;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  createStatsForLogs?: (field: string) => void;
  getRows?: () => LogRowModel[];
}

interface State {
  showFieldsStats: boolean;
  fieldCount: number;
  fieldLabel: string | null;
  fieldStats: LogLabelStatsModel[] | null;
  fieldValue: string | null;
}

class UnThemedLogDetailsRow extends PureComponent<Props, State> {
  state: State = {
    showFieldsStats: false,
    fieldCount: 0,
    fieldLabel: null,
    fieldStats: null,
    fieldValue: null,
  };

  filterLabel = () => {
    const { onClickFilterLabel, parsedKey, parsedValue } = this.props;
    if (onClickFilterLabel) {
      onClickFilterLabel(parsedKey, parsedValue);
    }
  };

  filterOutLabel = () => {
    const { onClickFilterOutLabel, parsedKey, parsedValue } = this.props;
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(parsedKey, parsedValue);
    }
  };

  showStats = () => {
    if (!this.state.showFieldsStats) {
      this.createStatsForLogs();
    }
    this.toggleFieldsStats();
  };

  toggleFieldsStats() {
    this.setState(state => {
      return {
        showFieldsStats: !state.showFieldsStats,
      };
    });
  }

  createStatsForLogs() {
    const { getRows, parser, field } = this.props;
    if (field && getRows) {
      const allRows = getRows();

      // Build value-agnostic row matcher based on the field label
      const fieldLabel = parser!.getLabelFromField(field);
      const fieldValue = parser!.getValueFromField(field);
      const matcher = parser!.buildMatcher(fieldLabel);
      const fieldStats = calculateFieldStats(allRows, matcher);
      const fieldCount = fieldStats.reduce((sum, stat) => sum + stat.count, 0);
      this.setState({ fieldCount, fieldLabel, fieldStats, fieldValue });
    }
  }

  render() {
    const { theme, parsedKey, parsedValue, canShowMetrics, canFilter, canFilterOut } = this.props;
    const { showFieldsStats, fieldStats, fieldLabel, fieldValue, fieldCount } = this.state;
    const style = getLogRowStyles(theme);
    return (
      <div className={style.logsRowDetailsRow}>
        {/* Action buttons - show stats/filter results */}
        {canShowMetrics ? (
          <div onClick={this.showStats} className={style.logsRowDetailsIcon}>
            <i className={'fa fa-signal'} />
          </div>
        ) : (
          <div className={style.logsRowDetailsIcon} />
        )}
        {canFilter ? (
          <div onClick={() => this.filterLabel()} className={style.logsRowDetailsIcon}>
            <i className={'fa fa-search-plus'} />
          </div>
        ) : (
          <div className={style.logsRowDetailsIcon} />
        )}
        {canFilterOut ? (
          <div onClick={() => this.filterOutLabel()} className={style.logsRowDetailsIcon}>
            <i className={'fa fa-search-minus'} />
          </div>
        ) : (
          <div className={style.logsRowDetailsIcon} />
        )}

        {/* Key - value columns */}
        <div className={style.logsRowDetailsLabel}>
          <span>{parsedKey}</span>
        </div>
        <div className={style.logsRowCell}>
          <span>{parsedValue}</span>
          {showFieldsStats && (
            <div className={style.logsRowCell}>
              <LogLabelStats stats={fieldStats!} label={fieldLabel!} value={fieldValue!} rowCount={fieldCount} />
            </div>
          )}
        </div>
      </div>
    );
  }
}

export const LogDetailsRow = withTheme(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
