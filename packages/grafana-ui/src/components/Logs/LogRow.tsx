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
import { selectThemeVariant } from '../../themes/selectThemeVariant';

//Components
import { LogDetails } from './LogDetails';
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
  hasHoverBackground: boolean;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = selectThemeVariant({ light: theme.colors.gray7, dark: theme.colors.dark2 }, theme.type);
  return {
    topVerticalAlign: css`
      label: topVerticalAlign;
      vertical-align: top;
    `,
    hoverBackground: css`
      label: hoverBackground;
      background-color: ${bgColor};
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
   * We are using onMouse events to change background of Log Details Table to hover-state-background when
   * hovered over Log Row and vice versa. This can't be done with css because we use 2 separate table rows without common parent element.
   */
  addHoverBackground = () => {
    this.setState({
      hasHoverBackground: true,
    });
  };

  clearHoverBackground = () => {
    this.setState({
      hasHoverBackground: false,
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
      showLabels,
      showTime,
      wrapLogMessage,
      theme,
      getFieldLinks,
    } = this.props;
    const { showDetails, showContext, hasHoverBackground } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const styles = getStyles(theme);
    const showUtc = timeZone === 'utc';
    const showDetailsClassName = showDetails
      ? cx(['fa fa-chevron-down', styles.topVerticalAlign])
      : cx(['fa fa-chevron-right', styles.topVerticalAlign]);
    const hoverBackground = cx(style.logsRow, { [styles.hoverBackground]: hasHoverBackground });

    return (
      <>
        <tr
          className={hoverBackground}
          onMouseEnter={this.addHoverBackground}
          onMouseLeave={this.clearHoverBackground}
          onClick={this.toggleDetails}
        >
          {showDuplicates && (
            <td className={style.logsRowDuplicates}>
              {row.duplicates && row.duplicates > 0 ? `${row.duplicates + 1}x` : null}
            </td>
          )}
          <td className={style.logsRowLevel} />
          {!allowDetails && (
            <td title={showDetails ? 'Hide log details' : 'See log details'} className={style.logsRowToggleDetails}>
              <i className={showDetailsClassName} />
            </td>
          )}
          {showTime && showUtc && (
            <td className={style.logsRowLocalTime} title={`Local: ${row.timeLocal} (${row.timeFromNow})`}>
              {row.timeUtc}
            </td>
          )}
          {showTime && !showUtc && (
            <td className={style.logsRowLocalTime} title={`${row.timeUtc} (${row.timeFromNow})`}>
              {row.timeLocal}
            </td>
          )}
          {showLabels && row.uniqueLabels && (
            <td className={style.logsRowLabels}>
              <LogLabels labels={row.uniqueLabels} />
            </td>
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
            wrapLogMessage={wrapLogMessage}
            onToggleContext={this.toggleContext}
          />
        </tr>
        {this.state.showDetails && (
          <LogDetails
            className={hoverBackground}
            onMouseEnter={this.addHoverBackground}
            onMouseLeave={this.clearHoverBackground}
            showDuplicates={showDuplicates}
            getFieldLinks={getFieldLinks}
            onClickFilterLabel={onClickFilterLabel}
            onClickFilterOutLabel={onClickFilterOutLabel}
            getRows={getRows}
            row={row}
          />
        )}
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
