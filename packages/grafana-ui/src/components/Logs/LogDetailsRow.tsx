import React, { PureComponent } from 'react';
import {
  LogRowModel,
  LogsParser,
  LogLabelStatsModel,
  calculateFieldStats,
  calculateLogsLabelStats,
} from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

//Components
import { LogLabelStats } from './LogLabelStats';

export interface Props extends Themeable {
  parsedValue: string;
  parsedKey: string;
  field: string;
  row: LogRowModel;
  isLabel: boolean;
  parser?: LogsParser;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
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
    const { showFieldsStats } = this.state;
    if (!showFieldsStats) {
      this.createStatsForLabels();
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

  createStatsForLabels() {
    const { getRows, parser, parsedKey, parsedValue, isLabel } = this.props;
    const allRows = getRows();
    const fieldLabel = parsedKey;
    const fieldValue = parsedValue;
    let fieldStats = [];
    if (isLabel) {
      fieldStats = calculateLogsLabelStats(allRows, parsedKey);
    } else {
      const matcher = parser!.buildMatcher(fieldLabel);
      fieldStats = calculateFieldStats(allRows, matcher);
    }
    const fieldCount = fieldStats.reduce((sum, stat) => sum + stat.count, 0);
    this.setState({ fieldCount, fieldLabel, fieldStats, fieldValue });
  }

  render() {
    const { theme, parsedKey, parsedValue, isLabel } = this.props;
    const { showFieldsStats, fieldStats, fieldLabel, fieldValue, fieldCount } = this.state;
    const style = getLogRowStyles(theme);
    return (
      <div className={style.logsRowDetailsValue}>
        {/* Action buttons - show stats/filter results */}
        <div onClick={this.showStats} className={style.logsRowDetailsIcon}>
          <i className={'fa fa-signal'} />
        </div>
        {isLabel ? (
          <div onClick={() => this.filterLabel()} className={style.logsRowDetailsIcon}>
            <i className={'fa fa-search-plus'} />
          </div>
        ) : (
          <div className={style.logsRowDetailsIcon} />
        )}
        {isLabel ? (
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
              <LogLabelStats
                stats={fieldStats!}
                label={fieldLabel!}
                value={fieldValue!}
                rowCount={fieldCount}
                isLabel={isLabel}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

export const LogDetailsRow = withTheme(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
