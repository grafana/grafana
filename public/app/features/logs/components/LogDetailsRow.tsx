import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';

import { CoreApp, Field, GrafanaTheme2, LinkModel, LogLabelStatsModel, LogRowModel } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { ClipboardButton, DataLinkButton, Themeable2, ToolbarButton, ToolbarButtonRow, withTheme2 } from '@grafana/ui';

import { LogLabelStats } from './LogLabelStats';
import { getLogRowStyles } from './getLogRowStyles';

//Components

export interface Props extends Themeable2 {
  parsedValue: string;
  parsedKey: string;
  wrapLogMessage?: boolean;
  isLabel?: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  links?: Array<LinkModel<Field>>;
  getStats: () => LogLabelStatsModel[] | null;
  displayedFields: string[];
  onClickShowField: (key: string) => void;
  onClickHideField: (key: string) => void;
  row: LogRowModel;
  app?: CoreApp;
}

interface State {
  showFieldsStats: boolean;
  fieldCount: number;
  fieldStats: LogLabelStatsModel[] | null;
  mouseOver: boolean;
}

const getStyles = (theme: GrafanaTheme2) => {
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
    showingField: css`
      color: ${theme.colors.primary.text};
    `,
    copyButton: css`
      & > button {
        color: ${theme.colors.text.secondary};
        padding: 0;
        justify-content: center;
        border-radius: 50%;
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
    wrapLine: css`
      label: wrapLine;
      white-space: pre-wrap;
    `,
    toolbarButtonRow: css`
      label: toolbarButtonRow;
      gap: ${theme.spacing(0.5)};

      max-width: calc(3 * ${theme.spacing(theme.components.height.sm)});
      & > div {
        height: ${theme.spacing(theme.components.height.sm)};
        width: ${theme.spacing(theme.components.height.sm)};
        & > button {
          border: 0;
          background-color: transparent;
          height: inherit;

          &:hover {
            box-shadow: none;
            border-radius: 50%;
          }
        }
      }
    `,
    logDetailsStats: css`
      label: logDetailsStats;
      margin: ${theme.spacing(1, 0, 0, 0)};
    `,
    logDetailsValue: css`
      display: table-cell;
      vertical-align: middle;
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
  };
};

class UnThemedLogDetailsRow extends PureComponent<Props, State> {
  state: State = {
    showFieldsStats: false,
    fieldCount: 0,
    fieldStats: null,
    mouseOver: false,
  };

  showField = () => {
    const { onClickShowField: onClickShowDetectedField, parsedKey, row } = this.props;
    if (onClickShowDetectedField) {
      onClickShowDetectedField(parsedKey);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'enable',
    });
  };

  hideField = () => {
    const { onClickHideField: onClickHideDetectedField, parsedKey, row } = this.props;
    if (onClickHideDetectedField) {
      onClickHideDetectedField(parsedKey);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'disable',
    });
  };

  filterLabel = () => {
    const { onClickFilterLabel, parsedKey, parsedValue, row } = this.props;
    if (onClickFilterLabel) {
      onClickFilterLabel(parsedKey, parsedValue);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: row.datasourceType,
      filterType: 'include',
      logRowUid: row.uid,
    });
  };

  filterOutLabel = () => {
    const { onClickFilterOutLabel, parsedKey, parsedValue, row } = this.props;
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(parsedKey, parsedValue);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: row.datasourceType,
      filterType: 'exclude',
      logRowUid: row.uid,
    });
  };

  showStats = () => {
    const { getStats, isLabel, row, app } = this.props;
    const { showFieldsStats } = this.state;
    if (!showFieldsStats) {
      const fieldStats = getStats();
      const fieldCount = fieldStats ? fieldStats.reduce((sum, stat) => sum + stat.count, 0) : 0;
      this.setState({ fieldStats, fieldCount });
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

  hoverValueCopy() {
    const mouseOver = !this.state.mouseOver;
    this.setState({ mouseOver });
  }

  render() {
    const {
      theme,
      parsedKey,
      parsedValue,
      isLabel,
      links,
      displayedFields,
      wrapLogMessage,
      onClickFilterLabel,
      onClickFilterOutLabel,
    } = this.props;
    const { showFieldsStats, fieldStats, fieldCount, mouseOver } = this.state;
    const styles = getStyles(theme);
    const style = getLogRowStyles(theme);
    const hasFilteringFunctionality = onClickFilterLabel && onClickFilterOutLabel;

    const toggleFieldButton =
      displayedFields && displayedFields.includes(parsedKey) ? (
        <ToolbarButton
          className={styles.showingField}
          tooltip="Hide this field"
          iconOnly
          narrow
          icon="eye"
          onClick={this.hideField}
        ></ToolbarButton>
      ) : (
        <ToolbarButton
          tooltip="Show this field instead of the message"
          iconOnly
          narrow
          icon="eye"
          onClick={this.showField}
        ></ToolbarButton>
      );

    return (
      <>
        <tr className={cx(style.logDetailsValue)}>
          <td className={style.logsDetailsIcon}>
            <ToolbarButtonRow alignment="left" className={styles.toolbarButtonRow}>
              {hasFilteringFunctionality && (
                <ToolbarButton
                  iconOnly
                  narrow
                  icon="search-plus"
                  tooltip="Filter for value"
                  onClick={this.filterLabel}
                ></ToolbarButton>
              )}
              {hasFilteringFunctionality && (
                <ToolbarButton
                  iconOnly
                  narrow
                  icon="search-minus"
                  tooltip="Filter out value"
                  onClick={this.filterOutLabel}
                ></ToolbarButton>
              )}
              {toggleFieldButton}
              <ToolbarButton
                iconOnly
                className={showFieldsStats ? styles.showingField : ''}
                narrow
                icon="signal"
                tooltip="Ad-hoc statistics"
                onClick={this.showStats}
              ></ToolbarButton>
            </ToolbarButtonRow>
          </td>

          {/* Key - value columns */}
          <td className={style.logDetailsLabel}>{parsedKey}</td>
          <td
            className={cx(styles.wordBreakAll, wrapLogMessage && styles.wrapLine)}
            onMouseEnter={this.hoverValueCopy.bind(this)}
            onMouseLeave={this.hoverValueCopy.bind(this)}
          >
            <div className={styles.logDetailsValue}>
              {parsedValue}

              <div className={cx('show-on-hover', styles.copyButton)}>
                <ClipboardButton
                  getText={() => parsedValue}
                  title="Copy value to clipboard"
                  fill="text"
                  variant="secondary"
                  icon="copy"
                  size="md"
                />
              </div>

              {links?.map((link) => (
                <span key={link.title}>
                  &nbsp;
                  <DataLinkButton link={link} />
                </span>
              ))}
            </div>
          </td>
        </tr>
        {showFieldsStats && (
          <tr>
            <td>
              <ToolbarButton
                iconOnly
                className={showFieldsStats ? styles.showingField : ''}
                narrow
                icon="signal"
                tooltip="Hide ad-hoc statistics"
                onClick={this.showStats}
              ></ToolbarButton>
            </td>
            <td colSpan={2}>
              <div className={styles.logDetailsStats}>
                <LogLabelStats
                  stats={fieldStats!}
                  label={parsedKey}
                  value={parsedValue}
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
