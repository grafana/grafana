import React, { PureComponent } from 'react';
import { Field, LinkModel, LogRowModel, TimeZone, DataQueryResponse, GrafanaTheme } from '@grafana/data';
import { cx, css } from 'emotion';

import {
  LogRowContextRows,
  LogRowContextQueryErrors,
  HasMoreContextRows,
  LogRowContextProvider,
} from './LogRowContextProvider';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { stylesFactory } from '../../themes/stylesFactory';

//Components
import { LogDetails } from './LogDetails';
import { LogRowMessage } from './LogRowMessage';

interface Props extends Themeable {
  highlighterExpressions?: string[];
  row: LogRowModel;
  showDuplicates: boolean;
  showTime: boolean;
  timeZone: TimeZone;
  allowDetails?: boolean;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onContextClick?: () => void;
  getRowContext: (row: LogRowModel, options?: any) => Promise<DataQueryResponse>;
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
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
    this.setState(state => {
      return {
        showContext: !state.showContext,
      };
    });
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
      highlighterExpressions,
      allowDetails,
      row,
      showDuplicates,
      timeZone,
      showTime,
      theme,
      getFieldLinks,
    } = this.props;
    const { showDetails, showContext } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const styles = getStyles(theme);
    const showUtc = timeZone === 'utc';
    const showDetailsClassName = showDetails
      ? cx(['fa fa-chevron-down', styles.topVerticalAlign])
      : cx(['fa fa-chevron-right', styles.topVerticalAlign]);
    return (
      <div className={style.logsRow}>
        {showDuplicates && (
          <div className={style.logsRowDuplicates}>
            {row.duplicates && row.duplicates > 0 ? `${row.duplicates + 1}x` : null}
          </div>
        )}
        <div className={style.logsRowLevel} />
        {!allowDetails && (
          <div
            title={showDetails ? 'Hide log details' : 'See log details'}
            onClick={this.toggleDetails}
            className={style.logsRowToggleDetails}
          >
            <i className={showDetailsClassName} />
          </div>
        )}
        <div>
          <div onClick={this.toggleDetails}>
            {showTime && showUtc && (
              <div className={style.logsRowLocalTime} title={`Local: ${row.timeLocal} (${row.timeFromNow})`}>
                {row.timeUtc}
              </div>
            )}
            {showTime && !showUtc && (
              <div className={style.logsRowLocalTime} title={`${row.timeUtc} (${row.timeFromNow})`}>
                {row.timeLocal}
              </div>
            )}
            <LogRowMessage
              highlighterExpressions={highlighterExpressions}
              row={row}
              getRows={getRows}
              errors={errors}
              hasMoreContextRows={hasMoreContextRows}
              updateLimit={updateLimit}
              context={context}
              showContext={showContext}
              onToggleContext={this.toggleContext}
            />
          </div>
          {this.state.showDetails && (
            <LogDetails
              getFieldLinks={getFieldLinks}
              onClickFilterLabel={onClickFilterLabel}
              onClickFilterOutLabel={onClickFilterOutLabel}
              getRows={getRows}
              row={row}
            />
          )}
        </div>
      </div>
    );
  }

  render() {
    const { showContext } = this.state;

    if (showContext) {
      return (
        <>
          <LogRowContextProvider row={this.props.row} getRowContext={this.props.getRowContext}>
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
