import React, { PureComponent } from 'react';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { LogLabelStats } from './LogLabelStats';
import { LogRowModel, LogsParser, LogLabelStatsModel } from '@grafana/data';
import { calculateFieldStats } from '@grafana/data';

interface Props extends Themeable {
  valueDetail: string;
  keyDetail: string;
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
    const { onClickFilterLabel, keyDetail, valueDetail } = this.props;
    if (onClickFilterLabel) {
      onClickFilterLabel(keyDetail, valueDetail);
    }
  };

  filterOutLabel = () => {
    const { onClickFilterOutLabel, keyDetail, valueDetail } = this.props;
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(keyDetail, valueDetail);
    }
  };

  toggleFieldsStats = () => {
    this.setState(state => {
      return {
        showFieldsStats: !state.showFieldsStats,
      };
    });
  };

  createStatsForLogs = () => {
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
  };

  showStats = () => {
    this.createStatsForLogs();
    this.toggleFieldsStats();
  };

  render() {
    const { theme, keyDetail, valueDetail, canShowMetrics, canFilter, canFilterOut } = this.props;
    const { showFieldsStats, fieldStats, fieldLabel, fieldValue, fieldCount } = this.state;
    const style = getLogRowStyles(theme);
    return (
      <div key={keyDetail} className={style.logsRowDetailsRow}>
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
        <div className={style.logsRowDetailsLabel}>
          <span>{keyDetail}</span>
          {showFieldsStats && (
            <div className={style.logsRowCell}>
              <LogLabelStats
                stats={fieldStats!}
                label={fieldLabel!}
                value={fieldValue!}
                onClickClose={this.toggleFieldsStats}
                rowCount={fieldCount}
              />
            </div>
          )}
        </div>
        <div className={style.logsRowCell}>
          <span>{valueDetail}</span>
        </div>
      </div>
    );
  }
}

export const LogDetailsRow = withTheme(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
