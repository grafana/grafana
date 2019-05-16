import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { Themeable, withTheme, GrafanaTheme, selectThemeVariant } from '@grafana/ui';

import { LogsModel, LogRowModel } from 'app/core/logs_model';
import ElapsedTime from './ElapsedTime';

const rowSorter = (a: LogRowModel, b: LogRowModel) => a.timeEpochMs - b.timeEpochMs;

const getStyles = (theme: GrafanaTheme) => ({
  logsRowsLive: css`
    label: logs-rows-live;
    display: flex;
    flex-flow: column nowrap;
    height: 75vh;
    overflow-y: auto;
    :first-child {
      margin-top: auto !important;
    }
  `,
  logsRowFresh: css`
    label: logs-row-fresh;
    color: ${theme.colors.text};
    background-color: ${selectThemeVariant({ light: theme.colors.gray6, dark: theme.colors.gray1 }, theme.type)};
  `,
  logsRowOld: css`
    label: logs-row-old;
    opacity: 0.8;
  `,
  logsRowsIndicator: css`
    font-size: ${theme.typography.size.md};
    padding: ${theme.spacing.gutter} 0;
  `,
});

export interface Props extends Themeable {
  logsResult?: LogsModel;
}

export interface State {
  prevRows: LogRowModel[];
  renderCount: number;
}

class LiveLogs extends PureComponent<Props, State> {
  private liveEndDiv: HTMLDivElement = null;

  constructor(props: Props) {
    super(props);
    this.state = { prevRows: props.logsResult ? props.logsResult.rows : [], renderCount: 0 };
  }

  componentDidUpdate(prevProps: Props) {
    const prevRows: LogRowModel[] = prevProps.logsResult ? prevProps.logsResult.rows : [];
    const rows: LogRowModel[] = this.props.logsResult ? this.props.logsResult.rows : [];

    if (prevRows !== rows) {
      this.setState({
        prevRows,
        renderCount: this.state.renderCount + 1,
      });
    }

    if (this.liveEndDiv) {
      this.liveEndDiv.scrollIntoView(false);
    }
  }

  render() {
    const { theme } = this.props;
    const { prevRows, renderCount } = this.state;
    const styles = getStyles(theme);
    const rows: LogRowModel[] = this.props.logsResult ? this.props.logsResult.rows : [];
    const freshRows = rows
      .filter(row => !prevRows.includes(row))
      .map(row => ({ ...row, fresh: true }))
      .sort(rowSorter);
    const oldRows = prevRows.filter(row => rows.includes(row)).sort(rowSorter);
    const rowsToRender = oldRows.concat(freshRows);

    return (
      <>
        <div className={cx(['logs-rows', styles.logsRowsLive])}>
          {rowsToRender.map((row: any, index) => {
            return (
              <div
                className={row.fresh ? cx(['logs-row', styles.logsRowFresh]) : cx(['logs-row', styles.logsRowOld])}
                key={`${row.timeEpochMs}-${index}`}
              >
                <div className="logs-row__localtime" title={`${row.timestamp} (${row.timeFromNow})`}>
                  {row.timeLocal}
                </div>
                <div className="logs-row__message">{row.entry}</div>
              </div>
            );
          })}
          <div ref={element => (this.liveEndDiv = element)} />
        </div>
        <div className="logs-rows-indicator">
          <span>
            Last line received: <ElapsedTime renderCount={renderCount} humanize={true} /> ago
          </span>
        </div>
      </>
    );
  }
}

export const LiveLogsWithTheme = withTheme(LiveLogs);
