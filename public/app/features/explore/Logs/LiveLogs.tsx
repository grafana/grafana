import { css, cx, keyframes } from '@emotion/css';
import { PureComponent } from 'react';
import * as React from 'react';
import tinycolor from 'tinycolor2';

import { LogRowModel, dateTimeFormat, GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { Button, Themeable2, withTheme2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { LogMessageAnsi } from '../../logs/components/LogMessageAnsi';
import { getLogRowStyles } from '../../logs/components/getLogRowStyles';
import { sortLogRows } from '../../logs/utils';
import { ElapsedTime } from '../ElapsedTime';
import { filterLogRowsByIndex } from '../state/utils';

const getStyles = (theme: GrafanaTheme2) => {
  const fade = keyframes({
    from: {
      backgroundColor: tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString(),
    },
    to: {
      backgroundColor: 'transparent',
    },
  });

  return {
    logsRowsLive: css({
      label: 'logs-rows-live',
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      display: 'flex',
      flexFlow: 'column nowrap',
      height: '60vh',
      overflowY: 'scroll',
      ':first-child': {
        marginTop: 'auto !important',
      },
    }),
    logsRowFade: css({
      label: 'logs-row-fresh',
      color: theme.colors.text.primary,
      backgroundColor: tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString(),
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${fade} 1s ease-out 1s 1 normal forwards`,
      },
    }),
    logsRowsIndicator: css({
      fontSize: theme.typography.h6.fontSize,
      paddingTop: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    }),
    button: css({
      marginRight: theme.spacing(1),
    }),
    fullWidth: css({
      width: '100%',
    }),
  };
};

export interface Props extends Themeable2 {
  logRows?: LogRowModel[];
  timeZone: TimeZone;
  stopLive: () => void;
  onPause: () => void;
  onResume: () => void;
  onClear: () => void;
  clearedAtIndex: number | null;
  isPaused: boolean;
}

interface State {
  logRowsToRender?: LogRowModel[];
}

class LiveLogs extends PureComponent<Props, State> {
  private liveEndDiv: HTMLDivElement | null = null;
  private scrollContainerRef = React.createRef<HTMLTableSectionElement>();

  constructor(props: Props) {
    super(props);
    this.state = {
      logRowsToRender: props.logRows,
    };
  }

  static getDerivedStateFromProps(nextProps: Props, state: State) {
    if (nextProps.isPaused && nextProps.clearedAtIndex) {
      return {
        logRowsToRender: filterLogRowsByIndex(nextProps.clearedAtIndex, state.logRowsToRender),
      };
    }

    if (nextProps.isPaused) {
      return null;
    }

    return {
      // We update what we show only if not paused. We keep any background subscriptions running and keep updating
      // our state, but we do not show the updates, this allows us start again showing correct result after resuming
      // without creating a gap in the log results.
      logRowsToRender: nextProps.logRows,
    };
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
    }
  };

  rowsToRender = () => {
    const { isPaused } = this.props;
    let { logRowsToRender: rowsToRender = [] } = this.state;
    if (!isPaused) {
      // A perf optimisation here. Show just 100 rows when streaming and full length when the streaming is paused.
      rowsToRender = sortLogRows(rowsToRender, LogsSortOrder.Ascending).slice(-100);
    }
    return rowsToRender;
  };

  render() {
    const { theme, timeZone, onPause, onResume, onClear, isPaused } = this.props;
    const styles = getStyles(theme);
    const { logsRow, logsRowLocalTime, logsRowMessage } = getLogRowStyles(theme);

    return (
      <div>
        <table className={styles.fullWidth}>
          <tbody
            onScroll={isPaused ? undefined : this.onScroll}
            className={styles.logsRowsLive}
            ref={this.scrollContainerRef}
          >
            {this.rowsToRender().map((row: LogRowModel) => {
              return (
                <tr className={cx(logsRow, styles.logsRowFade)} key={row.uid}>
                  <td className={logsRowLocalTime}>{dateTimeFormat(row.timeEpochMs, { timeZone })}</td>
                  <td className={logsRowMessage}>{row.hasAnsi ? <LogMessageAnsi value={row.raw} /> : row.entry}</td>
                </tr>
              );
            })}
            <tr
              ref={(element) => {
                this.liveEndDiv = element;
                // This is triggered on every update so on every new row. It keeps the view scrolled at the bottom by
                // default.
                // As scrollTo is not implemented in JSDOM it needs to be part of the condition
                if (this.liveEndDiv && this.scrollContainerRef.current?.scrollTo && !isPaused) {
                  this.scrollContainerRef.current?.scrollTo(0, this.scrollContainerRef.current.scrollHeight);
                }
              }}
            />
          </tbody>
        </table>
        <div className={styles.logsRowsIndicator}>
          <Button
            icon={isPaused ? 'play' : 'pause'}
            variant="secondary"
            onClick={isPaused ? onResume : onPause}
            className={styles.button}
          >
            {isPaused ? t('explore.live-logs.resume', 'Resume') : t('explore.live-logs.pause', 'Pause')}
          </Button>
          <Button icon="trash-alt" variant="secondary" onClick={onClear} className={styles.button}>
            <Trans i18nKey="explore.live-logs.clear-logs">Clear logs</Trans>
          </Button>
          <Button icon="square-shape" variant="secondary" onClick={this.props.stopLive} className={styles.button}>
            <Trans i18nKey="explore.live-logs.exit-live-mode">Exit live mode</Trans>
          </Button>
          {isPaused ||
            (this.rowsToRender().length > 0 && (
              <span>
                <Trans
                  i18nKey="explore.live-logs.last-line-received"
                  components={{ elapsedTime: <ElapsedTime resetKey={this.props.logRows} humanize={true} /> }}
                >
                  Last line received: {'<elapsedTime />'} ago
                </Trans>
              </span>
            ))}
        </div>
      </div>
    );
  }
}

export const LiveLogsWithTheme = withTheme2(LiveLogs);
