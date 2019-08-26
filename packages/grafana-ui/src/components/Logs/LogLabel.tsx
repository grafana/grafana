import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { LogRowModel, LogLabelStatsModel, calculateLogsLabelStats } from '@grafana/data';

import { LogLabelStats } from './LogLabelStats';
import { GrafanaTheme, Themeable } from '../../types/theme';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
import { withTheme } from '../../themes/ThemeContext';

const getStyles = (theme: GrafanaTheme) => {
  return {
    logsLabel: css`
      label: logs-label;
      display: flex;
      padding: 0 2px;
      background-color: ${selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark6 }, theme.type)};
      border-radius: ${theme.border.radius};
      margin: 0 4px 2px 0;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    `,
    logsLabelValue: css`
      label: logs-label__value;
      display: inline-block;
      max-width: 20em;
      text-overflow: ellipsis;
      overflow: hidden;
    `,
    logsLabelIcon: css`
      label: logs-label__icon;
      border-left: solid 1px ${selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark1 }, theme.type)};
      padding: 0 2px;
      cursor: pointer;
      margin-left: 2px;
    `,
    logsLabelStats: css`
      position: absolute;
      top: 1.25em;
      left: -10px;
      z-index: 100;
      justify-content: space-between;
      box-shadow: 0 0 20px ${selectThemeVariant({ light: theme.colors.white, dark: theme.colors.black }, theme.type)};
    `,
  };
};

interface Props extends Themeable {
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

class UnThemedLogLabel extends PureComponent<Props, State> {
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
    const { getRows, label, plain, value, theme } = this.props;
    const styles = getStyles(theme);
    const { showStats, stats } = this.state;
    const tooltip = `${label}: ${value}`;
    return (
      <span className={cx([styles.logsLabel])}>
        <span className={cx([styles.logsLabelValue])} title={tooltip}>
          {value}
        </span>
        {!plain && (
          <span
            title="Filter for label"
            onClick={this.onClickLabel}
            className={cx([styles.logsLabelIcon, 'fa fa-search-plus'])}
          />
        )}
        {!plain && getRows && (
          <span onClick={this.onClickStats} className={cx([styles.logsLabelIcon, 'fa fa-signal'])} />
        )}
        {showStats && (
          <span className={cx([styles.logsLabelStats])}>
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

export const LogLabel = withTheme(UnThemedLogLabel);
LogLabel.displayName = 'LogLabel';
