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
} from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { cx, css } from 'emotion';

import {
  LogRowContextRows,
  LogRowContextQueryErrors,
  HasMoreContextRows,
  LogRowContextProvider,
  RowContextOptions,
} from './LogRowContextProvider';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { stylesFactory } from '../../themes/stylesFactory';
import { selectThemeVariant } from '../../themes/selectThemeVariant';

//Components
import { LogDetails } from './LogDetails';
import { LogRowMessageParsed } from './LogRowMessageParsed';
import { LogRowMessage } from './LogRowMessage';
import { LogLabels } from './LogLabels';

interface Props extends Themeable {
  highlighterExpressions?: string[];
  row: LogRowModel;
  showDuplicates: boolean;
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  timeZone: TimeZone;
  allowDetails?: boolean;
  logsSortOrder?: LogsSortOrder | null;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onContextClick?: () => void;
  getRowContext: (row: LogRowModel, options?: RowContextOptions) => Promise<DataQueryResponse>;
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  showContextToggle?: (row?: LogRowModel) => boolean;
  showParsedFields?: string[];
  onClickShowParsedField?: (key: string) => void;
  onClickHideParsedField?: (key: string) => void;
}

interface State {
  showContext: boolean;
  showDetails: boolean;
  hasHoverBackground: boolean;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = selectThemeVariant({ light: theme.palette.gray7, dark: theme.palette.dark2 }, theme.type);
  return {
    topVerticalAlign: css`
      label: topVerticalAlign;
      vertical-align: top;
      margin-top: -${theme.spacing.xs};
      margin-left: -${theme.spacing.xxs};
    `,
    hoverBackground: css`
      label: hoverBackground;
      background-color: ${bgColor};
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
    hasHoverBackground: false,
  };

  toggleContext = () => {
    this.setState(state => {
      return {
        showContext: !state.showContext,
      };
    });
  };

  /**
   * We are using onMouse events to change background of Log Details Table to hover-state-background when hovered over Log
   * Row and vice versa, when context is not open. This can't be done with css because we use 2 separate table rows without common parent element.
   */
  addHoverBackground = () => {
    if (!this.state.showContext) {
      this.setState({
        hasHoverBackground: true,
      });
    }
  };

  clearHoverBackground = () => {
    if (!this.state.showContext) {
      this.setState({
        hasHoverBackground: false,
      });
    }
  };

  toggleDetails = () => {
    if (this.props.allowDetails) {
      return;
    }
    this.setState(state => {
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
      onClickShowParsedField,
      onClickHideParsedField,
      highlighterExpressions,
      allowDetails,
      row,
      showDuplicates,
      showContextToggle,
      showLabels,
      showTime,
      showParsedFields,
      wrapLogMessage,
      theme,
      getFieldLinks,
    } = this.props;
    const { showDetails, showContext, hasHoverBackground } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const styles = getStyles(theme);
    const { errorMessage, hasError } = checkLogsError(row);
    const logRowBackground = cx(style.logsRow, {
      [styles.hoverBackground]: hasHoverBackground,
      [styles.errorLogRow]: hasError,
    });

    return (
      <>
        <tr className={logRowBackground} onClick={this.toggleDetails}>
          {showDuplicates && (
            <td className={style.logsRowDuplicates}>
              {row.duplicates && row.duplicates > 0 ? `${row.duplicates + 1}x` : null}
            </td>
          )}
          <td className={cx({ [style.logsRowLevel]: !hasError })}>
            {hasError && (
              <Tooltip content={`Error: ${errorMessage}`} placement="right" theme="error">
                <Icon className={style.logIconError} name="exclamation-triangle" size="sm" />
              </Tooltip>
            )}
          </td>
          {!allowDetails && (
            <td title={showDetails ? 'Hide log details' : 'See log details'} className={style.logsRowToggleDetails}>
              <Icon className={styles.topVerticalAlign} name={showDetails ? 'angle-down' : 'angle-right'} />
            </td>
          )}
          {showTime && <td className={style.logsRowLocalTime}>{this.renderTimeStamp(row.timeEpochMs)}</td>}
          {showLabels && row.uniqueLabels && (
            <td className={style.logsRowLabels}>
              <LogLabels labels={row.uniqueLabels} />
            </td>
          )}
          {showParsedFields && showParsedFields.length > 0 ? (
            <LogRowMessageParsed row={row} showParsedFields={showParsedFields!} getFieldLinks={getFieldLinks} />
          ) : (
            <LogRowMessage
              highlighterExpressions={highlighterExpressions}
              row={row}
              getRows={getRows}
              errors={errors}
              hasMoreContextRows={hasMoreContextRows}
              updateLimit={updateLimit}
              context={context}
              contextIsOpen={showContext}
              showContextToggle={showContextToggle}
              wrapLogMessage={wrapLogMessage}
              onToggleContext={this.toggleContext}
            />
          )}
        </tr>
        {this.state.showDetails && (
          <LogDetails
            className={logRowBackground}
            onMouseEnter={this.addHoverBackground}
            onMouseLeave={this.clearHoverBackground}
            showDuplicates={showDuplicates}
            getFieldLinks={getFieldLinks}
            onClickFilterLabel={onClickFilterLabel}
            onClickFilterOutLabel={onClickFilterOutLabel}
            onClickShowParsedField={onClickShowParsedField}
            onClickHideParsedField={onClickHideParsedField}
            getRows={getRows}
            row={row}
            hasError={hasError}
            showParsedFields={showParsedFields}
          />
        )}
      </>
    );
  }

  render() {
    const { showContext } = this.state;
    const { logsSortOrder } = this.props;

    if (showContext) {
      return (
        <>
          <LogRowContextProvider
            row={this.props.row}
            getRowContext={this.props.getRowContext}
            logsSortOrder={logsSortOrder}
          >
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
