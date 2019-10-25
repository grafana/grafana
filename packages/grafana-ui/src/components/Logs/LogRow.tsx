import React, { PureComponent } from 'react';
import { LogRowModel, TimeZone } from '@grafana/data';
import { cx } from 'emotion';
import { DataQueryResponse } from '../../index';
import {
  LogRowContextRows,
  LogRowContextQueryErrors,
  HasMoreContextRows,
  LogRowContextProvider,
} from './LogRowContextProvider';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { LogDetails } from './LogDetails';

interface Props extends Themeable {
  highlighterExpressions?: string[];
  row: LogRowModel;
  showDuplicates: boolean;
  showTime: boolean;
  timeZone: TimeZone;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onContextClick?: () => void;
  getRowContext: (row: LogRowModel, options?: any) => Promise<DataQueryResponse>;
}

interface State {
  showContext: boolean;
  showDetails: boolean;
}

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
      row,
      showDuplicates,
      timeZone,
      showTime,
      theme,
    } = this.props;
    const { showDetails } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const showUtc = timeZone === 'utc';
    return (
      <>
        <div className={cx([style.logsRow])}>
          {showDuplicates && (
            <div className={cx([style.logsRowDuplicates])}>
              {row.duplicates && row.duplicates > 0 ? `${row.duplicates + 1}x` : null}
            </div>
          )}
          <div className={cx([style.logsRowLevel])} />
          <div onClick={this.toggleDetails} className={cx([style.logsRowToggleDetails])}>
            <i className={showDetails ? 'fa fa-chevron-up' : 'fa fa-chevron-down'} />
          </div>
          <div>
            <div>
              {showTime && showUtc && (
                <div className={cx([style.logsRowLocalTime])} title={`Local: ${row.timeLocal} (${row.timeFromNow})`}>
                  {row.timeUtc}
                </div>
              )}

              {showTime && !showUtc && (
                <div className={cx([style.logsRowLocalTime])} title={`${row.timeUtc} (${row.timeFromNow})`}>
                  {row.timeLocal}
                </div>
              )}
              <div className={cx([style.logsRowCell])}>{row.raw}</div>
            </div>
            <div>
              {this.state.showDetails && (
                <div className={cx([style.logsRowCell])}>
                  <LogDetails
                    onClickFilterLabel={onClickFilterLabel}
                    onClickFilterOutLabel={onClickFilterOutLabel}
                    getRows={getRows}
                    row={row}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </>
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
