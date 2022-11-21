import { cx, css } from '@emotion/css';
import React, { PureComponent } from 'react';

import {
  Field,
  LinkModel,
  LogRowModel,
  LogsSortOrder,
  TimeZone,
  DataQueryResponse,
  dateTimeFormat,
  GrafanaTheme2,
  CoreApp,
  DataFrame,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { styleMixins, withTheme2, Themeable2, Icon, Tooltip } from '@grafana/ui';

import { checkLogsError, escapeUnescapedString } from '../utils';

import { LogDetails } from './LogDetails';
import { LogLabels } from './LogLabels';
import {
  LogRowContextRows,
  LogRowContextQueryErrors,
  HasMoreContextRows,
  LogRowContextProvider,
  RowContextOptions,
} from './LogRowContextProvider';
import { LogRowMessage } from './LogRowMessage';
import { LogRowMessageDetectedFields } from './LogRowMessageDetectedFields';
import { getLogRowStyles } from './getLogRowStyles';

//Components

interface Props extends Themeable2 {
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
  scrollElement?: HTMLDivElement;
  showRowMenu?: boolean;
  app?: CoreApp;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onContextClick?: () => void;
  getRowContext: (row: LogRowModel, options?: RowContextOptions) => Promise<DataQueryResponse>;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onClickShowDetectedField?: (key: string) => void;
  onClickHideDetectedField?: (key: string) => void;
  onLogRowHover?: (row?: LogRowModel) => void;
  toggleContextIsOpen?: () => void;
}

interface State {
  showContext: boolean;
  showDetails: boolean;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    topVerticalAlign: css`
      label: topVerticalAlign;
      margin-top: -${theme.spacing(0.9)};
      margin-left: -${theme.spacing(0.25)};
    `,
    detailsOpen: css`
      &:hover {
        background-color: ${styleMixins.hoverColor(theme.colors.background.primary, theme)};
      }
    `,
    errorLogRow: css`
      label: erroredLogRow;
      color: ${theme.colors.text.secondary};
    `,
  };
};
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

  toggleContext = (method: string) => {
    const { datasourceType, uid: logRowUid } = this.props.row;
    reportInteraction('grafana_explore_logs_log_context_clicked', {
      datasourceType,
      logRowUid,
      type: method,
    });

    this.props.toggleContextIsOpen?.();
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

    reportInteraction('grafana_explore_logs_log_details_clicked', {
      datasourceType: this.props.row.datasourceType,
      type: this.state.showDetails ? 'close' : 'open',
      logRowUid: this.props.row.uid,
      app: this.props.app,
    });

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
    updateLimit?: () => void,
    logsSortOrder?: LogsSortOrder | null
  ) {
    const {
      getRows,
      onClickFilterLabel,
      onClickFilterOutLabel,
      onClickShowDetectedField,
      onClickHideDetectedField,
      enableLogDetails,
      row,
      showDuplicates,
      showContextToggle,
      showRowMenu,
      showLabels,
      showTime,
      showDetectedFields,
      wrapLogMessage,
      prettifyLogMessage,
      theme,
      getFieldLinks,
      forceEscape,
      onLogRowHover,
      app,
      scrollElement,
    } = this.props;
    const { showDetails, showContext } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const styles = getStyles(theme);
    const { errorMessage, hasError } = checkLogsError(row);
    const logRowBackground = cx(style.logsRow, {
      [styles.errorLogRow]: hasError,
      [style.contextBackground]: showContext,
    });

    const processedRow =
      row.hasUnescapedContent && forceEscape
        ? { ...row, entry: escapeUnescapedString(row.entry), raw: escapeUnescapedString(row.raw) }
        : row;

    return (
      <>
        <tr
          className={logRowBackground}
          onClick={this.toggleDetails}
          onMouseEnter={() => {
            onLogRowHover && onLogRowHover(row);
          }}
          onMouseLeave={() => {
            onLogRowHover && onLogRowHover(undefined);
          }}
        >
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
              row={processedRow}
              getRows={getRows}
              errors={errors}
              hasMoreContextRows={hasMoreContextRows}
              updateLimit={updateLimit}
              context={context}
              contextIsOpen={showContext}
              showContextToggle={showContextToggle}
              showRowMenu={showRowMenu}
              wrapLogMessage={wrapLogMessage}
              prettifyLogMessage={prettifyLogMessage}
              onToggleContext={this.toggleContext}
              app={app}
              scrollElement={scrollElement}
              logsSortOrder={logsSortOrder}
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
            app={app}
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
            {({ result, errors, hasMoreContextRows, updateLimit, logsSortOrder }) => {
              return <>{this.renderLogRow(result, errors, hasMoreContextRows, updateLimit, logsSortOrder)}</>;
            }}
          </LogRowContextProvider>
        </>
      );
    }

    return this.renderLogRow();
  }
}

export const LogRow = withTheme2(UnThemedLogRow);
LogRow.displayName = 'LogRow';
