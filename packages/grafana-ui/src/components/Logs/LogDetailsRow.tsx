import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';

import { Field, LinkModel, LogLabelStatsModel, GrafanaTheme2 } from '@grafana/data';

import { withTheme2 } from '../../themes/index';
import { Themeable2 } from '../../types/theme';
import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { DataLinkButton } from '../DataLinks/DataLinkButton';
import { IconButton } from '../IconButton/IconButton';

import { LogLabelStats } from './LogLabelStats';
import { getLogRowStyles } from './getLogRowStyles';

/** @deprecated will be removed in the next major version */
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
      border-radius: 20px;
      width: 26px;
      height: 26px;
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
    const { onClickShowDetectedField, parsedKey } = this.props;
    if (onClickShowDetectedField) {
      onClickShowDetectedField(parsedKey);
    }
  };

  hideField = () => {
    const { onClickHideDetectedField, parsedKey } = this.props;
    if (onClickHideDetectedField) {
      onClickHideDetectedField(parsedKey);
    }
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

/** @deprecated will be removed in the next major version */
export const LogDetailsRow = withTheme2(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
