import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';

import { CoreApp, Field, GrafanaTheme2, LinkModel, LogLabelStatsModel, LogRowModel } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { ClipboardButton, DataLinkButton, IconButton, Themeable2, withTheme2 } from '@grafana/ui';

import { LogLabelStats } from './LogLabelStats';
import { getLogRowStyles } from './getLogRowStyles';

//Components

export interface Props extends Themeable2 {
  parsedValues: string[];
  parsedKeys: string[];
  disableActions: boolean;
  wrapLogMessage?: boolean;
  isLabel?: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  links?: Array<LinkModel<Field>>;
  getStats: () => LogLabelStatsModel[] | null;
  displayedFields?: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  row: LogRowModel;
  app?: CoreApp;
}

interface State {
  showFieldsStats: boolean;
  fieldCount: number;
  fieldStats: LogLabelStatsModel[] | null;
}

const getStyles = memoizeOne((theme: GrafanaTheme2) => {
  return {
    wordBreakAll: css`
      label: wordBreakAll;
      word-break: break-all;
    `,
    copyButton: css`
      & > button {
        color: ${theme.colors.text.secondary};
        padding: 0;
        justify-content: center;
        border-radius: ${theme.shape.radius.circle};
        height: ${theme.spacing(theme.components.height.sm)};
        width: ${theme.spacing(theme.components.height.sm)};
        svg {
          margin: 0;
        }

        span > div {
          top: -5px;
          & button {
            color: ${theme.colors.success.main};
          }
        }
      }
    `,
    adjoiningLinkButton: css`
      margin-left: ${theme.spacing(1)};
    `,
    wrapLine: css`
      label: wrapLine;
      white-space: pre-wrap;
    `,
    logDetailsStats: css`
      padding: 0 ${theme.spacing(1)};
    `,
    logDetailsValue: css`
      display: flex;
      align-items: center;
      line-height: 22px;

      .show-on-hover {
        display: inline;
        visibility: hidden;
      }
      &:hover {
        .show-on-hover {
          visibility: visible;
        }
      }
    `,
    buttonRow: css`
      display: flex;
      flex-direction: row;
      gap: ${theme.spacing(0.5)};
      margin-left: ${theme.spacing(0.5)};
    `,
  };
});

class UnThemedLogDetailsRow extends PureComponent<Props, State> {
  state: State = {
    showFieldsStats: false,
    fieldCount: 0,
    fieldStats: null,
  };

  componentDidUpdate() {
    if (this.state.showFieldsStats) {
      this.updateStats();
    }
  }

  showField = () => {
    const { onClickShowField: onClickShowDetectedField, parsedKeys, row } = this.props;
    if (onClickShowDetectedField) {
      onClickShowDetectedField(parsedKeys[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'enable',
    });
  };

  hideField = () => {
    const { onClickHideField: onClickHideDetectedField, parsedKeys, row } = this.props;
    if (onClickHideDetectedField) {
      onClickHideDetectedField(parsedKeys[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'disable',
    });
  };

  filterLabel = () => {
    const { onClickFilterLabel, parsedKeys, parsedValues, row } = this.props;
    if (onClickFilterLabel) {
      onClickFilterLabel(parsedKeys[0], parsedValues[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: row.datasourceType,
      filterType: 'include',
      logRowUid: row.uid,
    });
  };

  filterOutLabel = () => {
    const { onClickFilterOutLabel, parsedKeys, parsedValues, row } = this.props;
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(parsedKeys[0], parsedValues[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: row.datasourceType,
      filterType: 'exclude',
      logRowUid: row.uid,
    });
  };

  updateStats = () => {
    const { getStats } = this.props;
    const fieldStats = getStats();
    const fieldCount = fieldStats ? fieldStats.reduce((sum, stat) => sum + stat.count, 0) : 0;
    if (!isEqual(this.state.fieldStats, fieldStats) || fieldCount !== this.state.fieldCount) {
      this.setState({ fieldStats, fieldCount });
    }
  };

  showStats = () => {
    const { isLabel, row, app } = this.props;
    const { showFieldsStats } = this.state;
    if (!showFieldsStats) {
      this.updateStats();
    }
    this.toggleFieldsStats();

    reportInteraction('grafana_explore_logs_log_details_stats_clicked', {
      dataSourceType: row.datasourceType,
      fieldType: isLabel ? 'label' : 'detectedField',
      type: showFieldsStats ? 'close' : 'open',
      logRowUid: row.uid,
      app,
    });
  };

  toggleFieldsStats() {
    this.setState((state) => {
      return {
        showFieldsStats: !state.showFieldsStats,
      };
    });
  }

  generateClipboardButton(val: string) {
    const { theme } = this.props;
    const styles = getStyles(theme);

    return (
      <div className={cx('show-on-hover', styles.copyButton)}>
        <ClipboardButton
          getText={() => val}
          title="Copy value to clipboard"
          fill="text"
          variant="secondary"
          icon="copy"
          size="md"
        />
      </div>
    );
  }

  generateMultiVal(value: string[], showCopy?: boolean) {
    return (
      <table>
        <tbody>
          {value?.map((val, i) => {
            return (
              <tr key={`${val}-${i}`}>
                <td>
                  {val}
                  {showCopy && val !== '' && this.generateClipboardButton(val)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  render() {
    const {
      theme,
      parsedKeys,
      parsedValues,
      isLabel,
      links,
      displayedFields,
      wrapLogMessage,
      onClickFilterLabel,
      onClickFilterOutLabel,
      disableActions,
    } = this.props;
    const { showFieldsStats, fieldStats, fieldCount } = this.state;
    const styles = getStyles(theme);
    const style = getLogRowStyles(theme);
    const singleKey = parsedKeys == null ? false : parsedKeys.length === 1;
    const singleVal = parsedValues == null ? false : parsedValues.length === 1;
    const hasFilteringFunctionality = !disableActions && onClickFilterLabel && onClickFilterOutLabel;

    const isMultiParsedValueWithNoContent =
      !singleVal && parsedValues != null && !parsedValues.every((val) => val === '');

    const toggleFieldButton =
      displayedFields && parsedKeys != null && displayedFields.includes(parsedKeys[0]) ? (
        <IconButton variant="primary" tooltip="Hide this field" name="eye" onClick={this.hideField} />
      ) : (
        <IconButton tooltip="Show this field instead of the message" name="eye" onClick={this.showField} />
      );

    return (
      <>
        <tr className={cx(style.logDetailsValue)}>
          <td className={style.logsDetailsIcon}>
            <div className={styles.buttonRow}>
              {hasFilteringFunctionality && (
                <IconButton name="search-plus" tooltip="Filter for value" onClick={this.filterLabel} />
              )}
              {hasFilteringFunctionality && (
                <IconButton name="search-minus" tooltip="Filter out value" onClick={this.filterOutLabel} />
              )}
              {!disableActions && displayedFields && toggleFieldButton}
              {!disableActions && (
                <IconButton
                  variant={showFieldsStats ? 'primary' : 'secondary'}
                  name="signal"
                  tooltip="Ad-hoc statistics"
                  className="stats-button"
                  disabled={!singleKey}
                  onClick={this.showStats}
                />
              )}
            </div>
          </td>

          {/* Key - value columns */}
          <td className={style.logDetailsLabel}>{singleKey ? parsedKeys[0] : this.generateMultiVal(parsedKeys)}</td>
          <td className={cx(styles.wordBreakAll, wrapLogMessage && styles.wrapLine)}>
            <div className={styles.logDetailsValue}>
              {singleVal ? parsedValues[0] : this.generateMultiVal(parsedValues, true)}
              {singleVal && this.generateClipboardButton(parsedValues[0])}
              <div className={cx((singleVal || isMultiParsedValueWithNoContent) && styles.adjoiningLinkButton)}>
                {links?.map((link, i) => (
                  <span key={`${link.title}-${i}`}>
                    <DataLinkButton link={link} />
                  </span>
                ))}
              </div>
            </div>
          </td>
        </tr>
        {showFieldsStats && singleKey && singleVal && (
          <tr>
            <td>
              <IconButton
                variant={showFieldsStats ? 'primary' : 'secondary'}
                name="signal"
                tooltip="Hide ad-hoc statistics"
                onClick={this.showStats}
              />
            </td>
            <td colSpan={2}>
              <div className={styles.logDetailsStats}>
                <LogLabelStats
                  stats={fieldStats!}
                  label={parsedKeys[0]}
                  value={parsedValues[0]}
                  rowCount={fieldCount}
                  isLabel={isLabel}
                />
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }
}

export const LogDetailsRow = withTheme2(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
