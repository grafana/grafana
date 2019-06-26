import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import {
  Themeable,
  withTheme,
  GrafanaTheme,
  selectThemeVariant,
  LinkButton,
  LogsModel,
  LogRowModel,
  TimeZone,
} from '@grafana/ui';

import ElapsedTime from './ElapsedTime';

const getStyles = (theme: GrafanaTheme) => ({
  logsRowsLive: css`
    label: logs-rows-live;
    display: flex;
    flex-flow: column nowrap;
    height: 65vh;
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
    padding: ${theme.spacing.sm} 0;
    display: flex;
    align-items: center;
  `,
});

export interface Props extends Themeable {
  logsResult?: LogsModel;
  timeZone: TimeZone;
  stopLive: () => void;
}

export interface State {
  renderCount: number;
}

class LiveLogs extends PureComponent<Props, State> {
  private liveEndDiv: HTMLDivElement = null;

  constructor(props: Props) {
    super(props);
    this.state = { renderCount: 0 };
  }

  componentDidUpdate(prevProps: Props) {
    const prevRows: LogRowModel[] = prevProps.logsResult ? prevProps.logsResult.rows : [];
    const rows: LogRowModel[] = this.props.logsResult ? this.props.logsResult.rows : [];

    if (prevRows !== rows) {
      this.setState({
        renderCount: this.state.renderCount + 1,
      });
    }

    if (this.liveEndDiv) {
      this.liveEndDiv.scrollIntoView(false);
    }
  }

  render() {
    const { theme, timeZone } = this.props;
    const { renderCount } = this.state;
    const styles = getStyles(theme);
    const rowsToRender: LogRowModel[] = this.props.logsResult ? this.props.logsResult.rows : [];
    const showUtc = timeZone === 'utc';

    return (
      <>
        <div className={cx(['logs-rows', styles.logsRowsLive])}>
          {rowsToRender.map((row: any, index) => {
            return (
              <div
                className={row.fresh ? cx(['logs-row', styles.logsRowFresh]) : cx(['logs-row', styles.logsRowOld])}
                key={`${row.timeEpochMs}-${index}`}
              >
                {showUtc && (
                  <div className="logs-row__localtime" title={`Local: ${row.timeLocal} (${row.timeFromNow})`}>
                    {row.timeUtc}
                  </div>
                )}
                {!showUtc && (
                  <div className="logs-row__localtime" title={`${row.timeUtc} (${row.timeFromNow})`}>
                    {row.timeLocal}
                  </div>
                )}
                <div className="logs-row__message">{row.entry}</div>
              </div>
            );
          })}
          <div
            ref={element => {
              this.liveEndDiv = element;
              if (this.liveEndDiv) {
                this.liveEndDiv.scrollIntoView(false);
              }
            }}
          />
        </div>
        <div className={cx([styles.logsRowsIndicator])}>
          <span>
            Last line received: <ElapsedTime renderCount={renderCount} humanize={true} /> ago
          </span>
          <LinkButton
            onClick={this.props.stopLive}
            size="md"
            variant="transparent"
            style={{ color: theme.colors.orange }}
          >
            Stop Live
          </LinkButton>
        </div>
      </>
    );
  }
}

export const LiveLogsWithTheme = withTheme(LiveLogs);
