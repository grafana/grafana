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
    noHoverEffect: css`
      label: noHoverEffect;
      :hover {
        background-color: transparent;
      }
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
      <div className={cx(style.logsRowDetailsValue, { [styles.noHoverEffect]: showFieldsStats })}>
        {/* Action buttons - show stats/filter results */}
        <div
          title="Ad-hoc statistics"
          onClick={this.showStats}
          aria-label={'Field stats'}
          className={style.logsRowDetailsIcon}
        >
          <i className={'fa fa-signal'} />
        </div>
        {isLabel ? (
          <div title="Filter for value" onClick={() => this.filterLabel()} className={style.logsRowDetailsIcon}>
            <i className={'fa fa-search-plus'} />
          </div>
        ) : (
          <div className={style.logsRowDetailsIcon} />
        )}
        {isLabel ? (
          <div title="Filter out value" onClick={() => this.filterOutLabel()} className={style.logsRowDetailsIcon}>
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
            <div className={style.logsRowCell}>
              <LogLabelStats
                stats={fieldStats!}
                label={parsedKey}
                value={parsedValue}
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
