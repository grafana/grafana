import React, { PureComponent } from 'react';
import { Field, LinkModel, LogLabelStatsModel } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { OpenDetailContext } from '../../utils/ui';

//Components
import { LogLabelStats } from './LogLabelStats';
import { LinkButton } from '../Button/Button';

export interface Props extends Themeable {
  parsedValue: string;
  parsedKey: string;
  isLabel?: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  links?: Array<LinkModel<Field>>;
  getStats: () => LogLabelStatsModel[] | null;
}

interface State {
  showFieldsStats: boolean;
  fieldCount: number;
  fieldStats: LogLabelStatsModel[] | null;
}

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
    const style = getLogRowStyles(theme);
    return (
      <div className={style.logsRowDetailsValue}>
        {/* Action buttons - show stats/filter results */}
        <div onClick={this.showStats} aria-label={'Field stats'} className={style.logsRowDetailsIcon}>
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
          {links &&
            links.map(link => {
              return (
                <span key={link.href}>
                  <OpenDetailContext.Consumer>
                    {openDetail => {
                      return (
                        <>
                          &nbsp;
                          <LinkButton
                            variant={'transparent'}
                            size={'sm'}
                            icon={'fa fa-list'}
                            href={link.href}
                            onClick={event => {
                              if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link.onClick) {
                                event.preventDefault();
                                link.onClick(event);
                                // openDetail({ datasourceId: 'Jaeger', query: parsedValue });
                              }
                            }}
                          />
                        </>
                      );
                    }}
                  </OpenDetailContext.Consumer>
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
