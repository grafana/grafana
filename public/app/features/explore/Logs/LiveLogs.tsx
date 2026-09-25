import { css, cx, keyframes } from '@emotion/css';
import { memo, useLayoutEffect, useRef, useState } from 'react';
import * as React from 'react';

import { type LogRowModel, dateTimeFormat, type GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type TimeZone } from '@grafana/schema';
import { Button, useStyles2 } from '@grafana/ui';

import { LogMessageAnsi } from '../../logs/components/LogMessageAnsi';
import { getLogRowStyles } from '../../logs/components/getLogRowStyles';
import { sortLogRows } from '../../logs/utils';
import { ElapsedTime } from '../ElapsedTime';
import { filterLogRowsByIndex } from '../state/utils';

const getStyles = (theme: GrafanaTheme2) => {
  const fade = keyframes({
    from: {
      backgroundColor: `rgb(from ${theme.colors.info.transparent} r g b / 0.25)`,
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
      backgroundColor: `rgb(from ${theme.colors.info.transparent} r g b / 0.25)`,
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

export interface Props {
  logRows?: LogRowModel[];
  timeZone: TimeZone;
  stopLive: () => void;
  onPause: () => void;
  onResume: () => void;
  onClear: () => void;
  clearedAtIndex: number | null;
  isPaused: boolean;
}

export const LiveLogs = memo(
  ({ logRows, timeZone, stopLive, onPause, onResume, onClear, clearedAtIndex, isPaused }: Props) => {
    const styles = useStyles2(getStyles);
    const { logsRow, logsRowLocalTime, logsRowMessage } = useStyles2(getLogRowStyles);
    const scrollContainerRef = useRef<HTMLTableSectionElement>(null);
    const [logRowsToRender, setLogRowsToRender] = useState(logRows);
    const [prevClearedAtIndex, setPrevClearedAtIndex] = useState(clearedAtIndex);

    // We update what we show only if not paused. We keep any background subscriptions running and keep updating
    // our state, but we do not show the updates, this allows us start again showing correct result after resuming
    // without creating a gap in the log results.
    if (!isPaused && logRowsToRender !== logRows) {
      setLogRowsToRender(logRows);
    }
    if (clearedAtIndex !== prevClearedAtIndex) {
      setPrevClearedAtIndex(clearedAtIndex);
      if (isPaused && clearedAtIndex) {
        setLogRowsToRender(filterLogRowsByIndex(clearedAtIndex, logRowsToRender));
      }
    }

    // A perf optimisation here. Show just 100 rows when streaming and full length when the streaming is paused.
    const rowsToRender = isPaused
      ? (logRowsToRender ?? [])
      : sortLogRows(logRowsToRender ?? [], LogsSortOrder.Ascending).slice(-100);

    // Runs on every update so on every new row. It keeps the view scrolled at the bottom by default.
    // As scrollTo is not implemented in JSDOM it needs to be part of the condition
    useLayoutEffect(() => {
      const container = scrollContainerRef.current;
      if (container?.scrollTo && !isPaused) {
        container.scrollTo(0, container.scrollHeight);
      }
    });

    /**
     * Handle pausing when user scrolls up so that we stop resetting his position to the bottom when new row arrives.
     * We do not need to throttle it here much, adding new rows should be throttled/buffered itself in the query epics
     * and after you pause we remove the handler and add it after you manually resume, so this should not be fired often.
     */
    const onScroll = (event: React.SyntheticEvent) => {
      const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      if (distanceFromBottom >= 5 && !isPaused) {
        onPause();
      }
    };

    return (
      <div>
        <table className={styles.fullWidth}>
          <tbody onScroll={isPaused ? undefined : onScroll} className={styles.logsRowsLive} ref={scrollContainerRef}>
            {rowsToRender.map((row: LogRowModel) => {
              return (
                <tr className={cx(logsRow, styles.logsRowFade)} key={row.uid}>
                  <td className={logsRowLocalTime}>{dateTimeFormat(row.timeEpochMs, { timeZone })}</td>
                  <td className={logsRowMessage}>{row.hasAnsi ? <LogMessageAnsi value={row.raw} /> : row.entry}</td>
                </tr>
              );
            })}
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
          <Button icon="square-shape" variant="secondary" onClick={stopLive} className={styles.button}>
            <Trans i18nKey="explore.live-logs.exit-live-mode">Exit live mode</Trans>
          </Button>
          {isPaused ||
            (rowsToRender.length > 0 && (
              <span>
                <Trans
                  i18nKey="explore.live-logs.last-line-received"
                  components={{ elapsedTime: <ElapsedTime resetKey={logRows} humanize={true} /> }}
                >
                  Last line received: {'<elapsedTime />'} ago
                </Trans>
              </span>
            ))}
        </div>
      </div>
    );
  }
);

LiveLogs.displayName = 'LiveLogs';
