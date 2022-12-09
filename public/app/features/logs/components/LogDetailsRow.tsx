import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';

import { Field, LinkModel, LogLabelStatsModel, GrafanaTheme2, LogRowModel, CoreApp } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { withTheme2, Themeable2, ClipboardButton, DataLinkButton, IconButton } from '@grafana/ui';

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
  showDetectedFields?: string[];
  onClickShowDetectedField?: (key: string) => void;
  onClickHideDetectedField?: (key: string) => void;
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
    hoverValueCopy: css`
      margin: ${theme.spacing(0, 0, 0, 1.2)};
      position: absolute;
      top: 0px;
      justify-content: center;
      border-radius: ${theme.shape.borderRadius(10)};
      width: ${theme.spacing(3.25)};
      height: ${theme.spacing(3.25)};
    `,
    wrapLine: css`
      label: wrapLine;
      white-space: pre-wrap;
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
    const { onClickShowDetectedField, parsedKey, row } = this.props;
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
    const { onClickHideDetectedField, parsedKey, row } = this.props;
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
      showDetectedFields,
      wrapLogMessage,
      onClickShowDetectedField,
      onClickHideDetectedField,
      onClickFilterLabel,
      onClickFilterOutLabel,
    } = this.props;
    const { showFieldsStats, fieldStats, fieldCount, mouseOver } = this.state;
    const styles = getStyles(theme);
    const style = getLogRowStyles(theme);

    const hasDetectedFieldsFunctionality = onClickShowDetectedField && onClickHideDetectedField;
    const hasFilteringFunctionality = onClickFilterLabel && onClickFilterOutLabel;

    const toggleFieldButton =
      !isLabel && showDetectedFields && showDetectedFields.includes(parsedKey) ? (
        <IconButton name="eye" className={styles.showingField} title="Hide this field" onClick={this.hideField} />
      ) : (
        <IconButton name="eye" title="Show this field instead of the message" onClick={this.showField} />
      );

    return (
      <tr className={cx(style.logDetailsValue, { [styles.noHoverBackground]: showFieldsStats })}>
        {/* Action buttons - show stats/filter results */}
        <td className={style.logsDetailsIcon}>
          <IconButton name="signal" title={'Ad-hoc statistics'} onClick={this.showStats} />
        </td>

        {hasFilteringFunctionality && isLabel && (
          <>
            <td className={style.logsDetailsIcon}>
              <IconButton name="search-plus" title="Filter for value" onClick={this.filterLabel} />
            </td>
            <td className={style.logsDetailsIcon}>
              <IconButton name="search-minus" title="Filter out value" onClick={this.filterOutLabel} />
            </td>
          </>
        )}

        {hasDetectedFieldsFunctionality && !isLabel && (
          <td className={style.logsDetailsIcon} colSpan={2}>
            {toggleFieldButton}
          </td>
        )}

        {/* Key - value columns */}
        <td className={style.logDetailsLabel}>{parsedKey}</td>
        <td
          className={cx(styles.wordBreakAll, wrapLogMessage && styles.wrapLine)}
          onMouseEnter={this.hoverValueCopy.bind(this)}
          onMouseLeave={this.hoverValueCopy.bind(this)}
        >
          {parsedValue}
          {mouseOver && (
            <ClipboardButton
              getText={() => parsedValue}
              title="Copy value to clipboard"
              fill="text"
              variant="secondary"
              icon="copy"
              size="sm"
              className={styles.hoverValueCopy}
            />
          )}
          {links?.map((link) => (
            <span key={link.title}>
              &nbsp;
              <DataLinkButton link={link} />
            </span>
          ))}
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

export const LogDetailsRow = withTheme2(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
