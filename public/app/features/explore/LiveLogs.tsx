import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import tinycolor from 'tinycolor2';

import { Themeable, withTheme, getLogRowStyles, Icon } from '@grafana/ui';
import { GrafanaTheme, LogRowModel, TimeZone, dateTimeFormat } from '@grafana/data';

import ElapsedTime from './ElapsedTime';

const getStyles = (theme: GrafanaTheme) => ({
  logsRowsLive: css`
    label: logs-rows-live;
    font-family: ${theme.typography.fontFamily.monospace};
    font-size: ${theme.typography.size.sm};
    display: flex;
    flex-flow: column nowrap;
    height: 65vh;
    overflow-y: auto;
    :first-child {
      margin-top: auto !important;
    }
  `,
  logsRowFade: css`
    label: logs-row-fresh;
    color: ${theme.colors.text};
    background-color: ${tinycolor(theme.palette.blue95)
      .setAlpha(0.25)
      .toString()};
    animation: fade 1s ease-out 1s 1 normal forwards;
    @keyframes fade {
      from {
        background-color: ${tinycolor(theme.palette.blue95)
          .setAlpha(0.25)
          .toString()};
      }
      to {
        background-color: transparent;
      }
    }
  `,
  logsRowsIndicator: css`
    font-size: ${theme.typography.size.md};
    padding-top: ${theme.spacing.sm};
    display: flex;
    align-items: center;
  `,
  button: css`
    margin-right: ${theme.spacing.sm};
  `,
  fullWidth: css`
    width: 100%;
  `,
});

export interface Props extends Themeable {
  logRows?: LogRowModel[];
  timeZone: TimeZone;
  stopLive: () => void;
  onPause: () => void;
  onResume: () => void;
  isPaused: boolean;
}

interface State {
  logRowsToRender?: LogRowModel[];
}

class LiveLogs extends PureComponent<Props, State> {
  private liveEndDiv: HTMLDivElement | null = null;
  private scrollContainerRef = React.createRef<HTMLTableSectionElement>();
  private lastScrollPos: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      logRowsToRender: props.logRows,
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (!prevProps.isPaused && this.props.isPaused) {
      // So we paused the view and we changed the content size, but we want to keep the relative offset from the bottom.
      if (this.lastScrollPos && this.scrollContainerRef.current) {
        // There is last scroll pos from when user scrolled up a bit so go to that position.
        const { clientHeight, scrollHeight } = this.scrollContainerRef.current;
        const scrollTop = scrollHeight - (this.lastScrollPos + clientHeight);
        this.scrollContainerRef.current.scrollTo(0, scrollTop);
        this.lastScrollPos = null;
      } else {
        // We do not have any position to jump to su the assumption is user just clicked pause. We can just scroll
        // to the bottom.
        if (this.liveEndDiv) {
          this.liveEndDiv.scrollIntoView(false);
        }
      }
    }
  }

  static getDerivedStateFromProps(nextProps: Props, state: State) {
    if (!nextProps.isPaused) {
      return {
        // We update what we show only if not paused. We keep any background subscriptions running and keep updating
        // our state, but we do not show the updates, this allows us start again showing correct result after resuming
        // without creating a gap in the log results.
        logRowsToRender: nextProps.logRows,
      };
    } else {
      return null;
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

  rowsToRender = () => {
    const { isPaused } = this.props;
    let { logRowsToRender: rowsToRender = [] } = this.state;
    if (!isPaused) {
      // A perf optimisation here. Show just 100 rows when streaming and full length when the streaming is paused.
      rowsToRender = rowsToRender.slice(-100);
    }
    return rowsToRender;
  };

  render() {
    const { theme, timeZone, onPause, onResume, isPaused } = this.props;
    const styles = getStyles(theme);
    const { logsRow, logsRowLocalTime, logsRowMessage } = getLogRowStyles(theme);

    return (
      <div>
        <table className={styles.fullWidth}>
          <tbody
            onScroll={isPaused ? undefined : this.onScroll}
            className={cx(['logs-rows', styles.logsRowsLive])}
            ref={this.scrollContainerRef}
          >
            {this.rowsToRender().map((row: LogRowModel) => {
              return (
                <tr className={cx(logsRow, styles.logsRowFade)} key={row.uid}>
                  <td className={cx(logsRowLocalTime)}>{dateTimeFormat(row.timeEpochMs, { timeZone })}</td>
                  <td className={cx(logsRowMessage)}>{row.entry}</td>
                </tr>
              );
            })}
            <tr
              ref={element => {
                this.liveEndDiv = element;
                // This is triggered on every update so on every new row. It keeps the view scrolled at the bottom by
                // default.
                if (this.liveEndDiv && !isPaused) {
                  this.liveEndDiv.scrollIntoView(false);
                }
              }}
            />
          </tbody>
        </table>
        <div className={cx([styles.logsRowsIndicator])}>
          <button onClick={isPaused ? onResume : onPause} className={cx('btn btn-secondary', styles.button)}>
            <Icon name={isPaused ? 'play' : 'pause'} />
            &nbsp;
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={this.props.stopLive} className={cx('btn btn-inverse', styles.button)}>
            <Icon name="square-shape" size="lg" type="mono" />
            &nbsp; Exit live mode
          </button>
          {isPaused || (
            <span>
              Last line received: <ElapsedTime resetKey={this.props.logRows} humanize={true} /> ago
            </span>
          )}
        </div>
      </div>
    );
  }
}

export const LiveLogsWithTheme = withTheme(LiveLogs);
