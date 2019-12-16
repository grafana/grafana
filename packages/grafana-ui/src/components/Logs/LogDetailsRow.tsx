import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { LogLabelStatsModel, GrafanaTheme } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { stylesFactory } from '../../themes/stylesFactory';

//Components
import { LogLabelStats } from './LogLabelStats';

export interface Props extends Themeable {
  parsedValue: string;
  parsedKey: string;
  isLabel?: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  links?: string[];
  getStats: () => LogLabelStatsModel[] | null;
}

interface State {
  showFieldsStats: boolean;
  fieldCount: number;
  fieldStats: LogLabelStatsModel[] | null;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    noHoverBackground: css`
      label: noHoverBackground;
      :hover {
        background-color: transparent;
      }
    `,
    hoverCursor: css`
      label: hoverCursor;
      cursor: pointer;
    `,
    wordBreakAll: css`
      label: wordBreakAll;
      word-break: break-all;
    `,
  };
});

class UnThemedLogDetailsRow extends PureComponent<Props, State> {
  state: State = {
    showFieldsStats: false,
    fieldCount: 0,
    fieldStats: null,
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
      const fieldStats = this.props.getStats();
      const fieldCount = fieldStats ? fieldStats.reduce((sum, stat) => sum + stat.count, 0) : 0;
      this.setState({ fieldStats, fieldCount });
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

  render() {
    const { theme, parsedKey, parsedValue, isLabel, links } = this.props;
    const { showFieldsStats, fieldStats, fieldCount } = this.state;
    const styles = getStyles(theme);
    const style = getLogRowStyles(theme);
    return (
      <tr className={cx(style.logDetailsValue, { [styles.noHoverBackground]: showFieldsStats })}>
        {/* Action buttons - show stats/filter results */}
        <td title="Ad-hoc statistics" onClick={this.showStats} className={style.logsDetailsIcon}>
          <i className={`fa fa-signal ${styles.hoverCursor}`} />
        </td>

        <td title="Filter for value" onClick={() => isLabel && this.filterLabel()} className={style.logsDetailsIcon}>
          {isLabel && <i className={`fa fa-search-plus ${styles.hoverCursor}`} />}
        </td>

        <td title="Filter out value" onClick={() => isLabel && this.filterOutLabel()} className={style.logsDetailsIcon}>
          {isLabel && <i className={`fa fa-search-minus ${styles.hoverCursor}`} />}
        </td>

        {/* Key - value columns */}
        <td className={style.logDetailsLabel}>{parsedKey}</td>
        <td className={styles.wordBreakAll}>
          {parsedValue}
          {links &&
            links.map(link => {
              return (
                <span key={link}>
                  &nbsp;
                  <a href={link} target={'_blank'}>
                    <i className={'fa fa-external-link'} />
                  </a>
                </span>
              );
            })}
          {showFieldsStats && (
            <LogLabelStats
              stats={fieldStats!}
              label={parsedKey}
              value={parsedValue}
              rowCount={fieldCount}
              isLabel={isLabel}
            />
          )}
        </td>
      </tr>
    );
  }
}

export const LogDetailsRow = withTheme(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
