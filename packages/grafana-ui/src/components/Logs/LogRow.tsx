import React, { PureComponent } from 'react';
import {
  Field,
  LinkModel,
  LogRowModel,
  LogsSortOrder,
  TimeZone,
  DataQueryResponse,
  GrafanaTheme,
  dateTimeFormat,
  checkLogsError,
  escapeUnescapedString,
} from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { cx, css } from '@emotion/css';

import {
  LogRowContextRows,
  LogRowContextQueryErrors,
  HasMoreContextRows,
  LogRowContextProvider,
  RowContextOptions,
} from './LogRowContextProvider';
import { Themeable } from '../../types/theme';
import { styleMixins, withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { stylesFactory } from '../../themes/stylesFactory';

//Components
import { LogDetails } from './LogDetails';
import { LogRowMessageDetectedFields } from './LogRowMessageDetectedFields';
import { LogRowMessage } from './LogRowMessage';
import { LogLabels } from './LogLabels';

interface Props extends Themeable {
  highlighterExpressions?: string[];
  row: LogRowModel;
  showDuplicates: boolean;
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  timeZone: TimeZone;
  enableLogDetails: boolean;
  logsSortOrder?: LogsSortOrder | null;
  forceEscape?: boolean;
  showDetectedFields?: string[];
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onContextClick?: () => void;
  getRowContext: (row: LogRowModel, options?: RowContextOptions) => Promise<DataQueryResponse>;
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onClickShowDetectedField?: (key: string) => void;
  onClickHideDetectedField?: (key: string) => void;
}

interface State {
  showContext: boolean;
  showDetails: boolean;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    topVerticalAlign: css`
      label: topVerticalAlign;
      vertical-align: top;
      margin-top: -${theme.spacing.xs};
      margin-left: -${theme.spacing.xxs};
    `,
    detailsOpen: css`
      &:hover {
        background-color: ${styleMixins.hoverColor(theme.colors.panelBg, theme)};
      }
    `,
    errorLogRow: css`
      label: erroredLogRow;
      color: ${theme.colors.textWeak};
    `,
  };
});
/**
 * Renders a log line.
 *
 * When user hovers over it for a certain time, it lazily parses the log line.
 * Once a parser is found, it will determine fields, that will be highlighted.
 * When the user requests stats for a field, they will be calculated and rendered below the row.
 */
class UnThemedLogRow extends PureComponent<Props, State> {
  state: State = {
    showContext: false,
    showDetails: false,
  };

  toggleContext = () => {
    this.setState((state) => {
      return {
        showContext: !state.showContext,
      };
    });
  };

  toggleDetails = () => {
    if (!this.props.enableLogDetails) {
      return;
    }
    this.setState((state) => {
      return {
        showDetails: !state.showDetails,
      };
    });
  };

  renderTimeStamp(epochMs: number) {
    return dateTimeFormat(epochMs, {
      timeZone: this.props.timeZone,
    });
  }

  renderLogRow(
    context?: LogRowContextRows,
    errors?: LogRowContextQueryErrors,
    hasMoreContextRows?: HasMoreContextRows,
    updateLimit?: () => void
  ) {
    const {
      getRows,
      onClickFilterLabel,
      onClickFilterOutLabel,
      onClickShowDetectedField,
      onClickHideDetectedField,
      highlighterExpressions,
      enableLogDetails,
      row,
      showDuplicates,
      showContextToggle,
      showLabels,
      showTime,
      showDetectedFields,
      wrapLogMessage,
      prettifyLogMessage,
      theme,
      getFieldLinks,
      forceEscape,
    } = this.props;
    const { showDetails, showContext } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const styles = getStyles(theme);
    const { errorMessage, hasError } = checkLogsError(row);
    const logRowBackground = cx(style.logsRow, {
      [styles.errorLogRow]: hasError,
    });

    const processedRow =
      row.hasUnescapedContent && forceEscape
        ? { ...row, entry: escapeUnescapedString(row.entry), raw: escapeUnescapedString(row.raw) }
        : row;

    return (
      <>
        <tr className={logRowBackground} onClick={this.toggleDetails}>
          {showDuplicates && (
            <td className={style.logsRowDuplicates}>
              {processedRow.duplicates && processedRow.duplicates > 0 ? `${processedRow.duplicates + 1}x` : null}
            </td>
          )}
          <td className={cx({ [style.logsRowLevel]: !hasError })}>
            {hasError && (
              <Tooltip content={`Error: ${errorMessage}`} placement="right" theme="error">
                <Icon className={style.logIconError} name="exclamation-triangle" size="xs" />
              </Tooltip>
            )}
          </td>
          {enableLogDetails && (
            <td title={showDetails ? 'Hide log details' : 'See log details'} className={style.logsRowToggleDetails}>
              <Icon className={styles.topVerticalAlign} name={showDetails ? 'angle-down' : 'angle-right'} />
            </td>
          )}
          {showTime && <td className={style.logsRowLocalTime}>{this.renderTimeStamp(row.timeEpochMs)}</td>}
          {showLabels && processedRow.uniqueLabels && (
            <td className={style.logsRowLabels}>
              <LogLabels labels={processedRow.uniqueLabels} />
            </td>
          )}
          {showDetectedFields && showDetectedFields.length > 0 ? (
            <LogRowMessageDetectedFields
              row={processedRow}
              showDetectedFields={showDetectedFields!}
              getFieldLinks={getFieldLinks}
              wrapLogMessage={wrapLogMessage}
            />
          ) : (
            <LogRowMessage
              highlighterExpressions={highlighterExpressions}
              row={processedRow}
              getRows={getRows}
              errors={errors}
              hasMoreContextRows={hasMoreContextRows}
              updateLimit={updateLimit}
              context={context}
              contextIsOpen={showContext}
              showContextToggle={showContextToggle}
              wrapLogMessage={wrapLogMessage}
              prettifyLogMessage={prettifyLogMessage}
              onToggleContext={this.toggleContext}
            />
          )}
        </tr>
        {this.state.showDetails && (
          <LogDetails
            className={logRowBackground}
            showDuplicates={showDuplicates}
            getFieldLinks={getFieldLinks}
            onClickFilterLabel={onClickFilterLabel}
            onClickFilterOutLabel={onClickFilterOutLabel}
            onClickShowDetectedField={onClickShowDetectedField}
            onClickHideDetectedField={onClickHideDetectedField}
            getRows={getRows}
            row={processedRow}
            wrapLogMessage={wrapLogMessage}
            hasError={hasError}
            showDetectedFields={showDetectedFields}
          />
        )}
      </>
    );
  }

  render() {
    const { showContext } = this.state;
    const { logsSortOrder, row, getRowContext } = this.props;

    if (showContext) {
      return (
        <>
          <LogRowContextProvider row={row} getRowContext={getRowContext} logsSortOrder={logsSortOrder}>
            {({ result, errors, hasMoreContextRows, updateLimit }) => {
              return <>{this.renderLogRow(result, errors, hasMoreContextRows, updateLimit)}</>;
            }}
          </LogRowContextProvider>
        </>
      );
    }

    return this.renderLogRow();
  }
}

export const LogRow = withTheme(UnThemedLogRow);
LogRow.displayName = 'LogRow';
