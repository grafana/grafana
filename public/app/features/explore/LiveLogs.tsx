import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { Themeable, withTheme, GrafanaTheme, selectThemeVariant, LinkButton } from '@grafana/ui';
import { LogsModel, LogRowModel, TimeZone } from '@grafana/data';

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
  onPause: () => void;
  onResume: () => void;
  isPaused: boolean;
}

export interface State {
  renderCount: number;
  logsResultToRender: LogsModel;
}

class LiveLogs extends PureComponent<Props, State> {
  private liveEndDiv: HTMLDivElement = null;
  private scrollContainerRef = React.createRef<HTMLDivElement>();
  private lastScrollPos: number | null = null;

  static getDerivedStateFromProps(nextProps: Props) {
    if (!nextProps.isPaused) {
      return {
        // We update what we show only if not paused. We keep any background subscriptions running and keep updating
        // our state, but we do not show the updates, this allows us start again showing correct result after resuming
        // without creating a gap in the log results.
        logsResultToRender: nextProps.logsResult,
      };
    } else {
      return null;
    }
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>): void {
    if (!prevProps.isPaused && this.props.isPaused) {
      // So we paused the view and we changed the content size, but we want to keep the relative offset from the bottom.
      if (this.lastScrollPos) {
        // There is last scroll pos from when user scrolled up a bit so go to that position.
        const { clientHeight, scrollHeight } = this.scrollContainerRef.current;
        const scrollTop = scrollHeight - (this.lastScrollPos + clientHeight);
        this.scrollContainerRef.current.scrollTo(0, scrollTop);
        this.lastScrollPos = null;
      } else {
        // We do not have any position to jump to su the assumption is user just clicked pause. We can just scroll
        // to the bottom.
        this.liveEndDiv.scrollIntoView(false);
      }
    }
  }

  /**
   * Handle pausing when user scrolls up so that we stop resetting his position to the bottom when new row arrives.
   * We do not need to throttle it here much, adding new rows should be throttled/buffered itself in the query epics
   * and after you pause we remove the handler and add it after you manually resume, so this should not be fired often.
   */
  onScroll = (event: React.SyntheticEvent) => {
    const { isPaused, onPause } = this.props;
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    if (distanceFromBottom >= 5 && !isPaused) {
      onPause();
      this.lastScrollPos = distanceFromBottom;
    }
  };

  render() {
    const { theme, timeZone, isPaused, onPause, onResume } = this.props;
    const styles = getStyles(theme);
    let rowsToRender: LogRowModel[] = this.state.logsResultToRender ? this.state.logsResultToRender.rows : [];
    const showUtc = timeZone === 'utc';

    if (!isPaused) {
      // A perf optimisation here. Show just 100 rows when streaming and full length when the streaming is paused.
      rowsToRender = rowsToRender.slice(-100);
    }

    return (
      <>
        <div
          onScroll={isPaused ? undefined : this.onScroll}
          className={cx(['logs-rows', styles.logsRowsLive])}
          ref={this.scrollContainerRef}
        >
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
              // This is triggered on every update so on every new row. It keeps the view scrolled at the bottom by
              // default.
              if (this.liveEndDiv && !isPaused) {
                this.liveEndDiv.scrollIntoView(false);
              }
            }}
          />
        </div>
        <div className={cx([styles.logsRowsIndicator])}>
          <span>
            Last line received: <ElapsedTime resetKey={this.props.logsResult} humanize={true} /> ago
          </span>
          <LinkButton
            onClick={isPaused ? onResume : onPause}
            size="md"
            variant="transparent"
            style={{ color: theme.colors.orange }}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </LinkButton>
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
