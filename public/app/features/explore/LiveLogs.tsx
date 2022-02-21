import React, { PureComponent } from 'react';
import { css, cx } from '@emotion/css';
import tinycolor from 'tinycolor2';

import { LogMessageAnsi, getLogRowStyles, Icon, Button, Themeable2, withTheme2, LogRows } from '@grafana/ui';
import {
  LogRowModel,
  TimeZone,
  dateTimeFormat,
  GrafanaTheme2,
  Field,
  LinkModel,
  LogsDedupStrategy,
  LogLevel,
  LogsSortOrder,
} from '@grafana/data';

import { ElapsedTime } from './ElapsedTime';
import store from 'app/core/store';
import memoizeOne from 'memoize-one';
import { dedupLogRows, filterLogLevels } from 'app/core/logs_model';
import { RowContextOptions } from '@grafana/ui/src/components/Logs/LogRowContextProvider';

const getStyles = (theme: GrafanaTheme2, wrapLogMessage: boolean) => ({
  logsRowsLive: css`
    label: logs-rows-live;
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
    display: flex;
    flex-flow: column nowrap;
    height: 60vh;
    overflow-y: scroll;
    :first-child {
      margin-top: auto !important;
    }
  `,
  logsRowFade: css`
    label: logs-row-fresh;
    color: ${theme.colors.text};
    background-color: ${tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString()};
    animation: fade 1s ease-out 1s 1 normal forwards;
    @keyframes fade {
      from {
        background-color: ${tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString()};
      }
      to {
        background-color: transparent;
      }
    }
  `,
  logsRowsIndicator: css`
    font-size: ${theme.typography.h6.fontSize};
    padding-top: ${theme.spacing(1)};
    display: flex;
    align-items: center;
  `,
  button: css`
    margin-right: ${theme.spacing(1)};
  `,
  fullWidth: css`
    width: 100%;
  `,
  logsSection: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  `,
  logRows: css`
    overflow-x: ${wrapLogMessage ? 'unset' : 'scroll'};
    overflow-y: visible;
    width: 100%;
  `,
});

const SETTINGS_KEYS = {
  showLabels: 'grafana.explore.logs.showLabels',
  showTime: 'grafana.explore.logs.showTime',
  wrapLogMessage: 'grafana.explore.logs.wrapLogMessage',
  prettifyLogMessage: 'grafana.explore.logs.prettifyLogMessage',
};

export interface Props extends Themeable2 {
  logRows?: LogRowModel[];
  timeZone: TimeZone;
  stopLive: () => void;
  onPause: () => void;
  onResume: () => void;
  isPaused: boolean;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  showContextToggle?: (row?: LogRowModel) => boolean;
  getRowContext?: (row: LogRowModel, options?: RowContextOptions) => Promise<any>;
}

interface State {
  logRowsToRender?: LogRowModel[];
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  dedupStrategy: LogsDedupStrategy;
  hiddenLogLevels: LogLevel[];
  logsSortOrder: LogsSortOrder | null;
  isFlipping: boolean;
  showDetectedFields: string[];
  forceEscape: boolean;
}

class LiveLogs extends PureComponent<Props, State> {
  flipOrderTimer?: number;
  cancelFlippingTimer?: number;
  // topLogsRef = createRef<HTMLDivElement>();

  state: State = {
    showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
    showTime: store.getBool(SETTINGS_KEYS.showTime, true),
    wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
    prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false),
    dedupStrategy: LogsDedupStrategy.none,
    hiddenLogLevels: [],
    logsSortOrder: null,
    isFlipping: false,
    showDetectedFields: [],
    forceEscape: false,
  };

  private liveEndDiv: HTMLDivElement | null = null;
  private scrollContainerRef = React.createRef<HTMLTableSectionElement>();

  constructor(props: Props) {
    super(props);
    this.state = {
      logRowsToRender: props.logRows,
      showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
      showTime: store.getBool(SETTINGS_KEYS.showTime, true),
      wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
      prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false),
      dedupStrategy: LogsDedupStrategy.none,
      hiddenLogLevels: [],
      logsSortOrder: null,
      isFlipping: false,
      showDetectedFields: [],
      forceEscape: false,
    };
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

  showDetectedField = (key: string) => {
    const index = this.state.showDetectedFields.indexOf(key);

    if (index === -1) {
      this.setState((state) => {
        return {
          showDetectedFields: state.showDetectedFields.concat(key),
        };
      });
    }
  };

  hideDetectedField = (key: string) => {
    const index = this.state.showDetectedFields.indexOf(key);
    if (index > -1) {
      this.setState((state) => {
        return {
          showDetectedFields: state.showDetectedFields.filter((k) => key !== k),
        };
      });
    }
  };

  dedupRows = memoizeOne((logRows: LogRowModel[], dedupStrategy: LogsDedupStrategy) => {
    const dedupedRows = dedupLogRows(logRows, dedupStrategy);
    const dedupCount = dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0);
    return { dedupedRows, dedupCount };
  });

  filterRows = memoizeOne((logRows: LogRowModel[], hiddenLogLevels: LogLevel[]) => {
    return filterLogLevels(logRows, new Set(hiddenLogLevels));
  });

  render() {
    const {
      theme,
      timeZone,
      onPause,
      onResume,
      isPaused,
      getFieldLinks,
      onClickFilterLabel,
      onClickFilterOutLabel,
      showContextToggle,
    } = this.props;

    const {
      showLabels,
      showTime,
      wrapLogMessage,
      prettifyLogMessage,
      dedupStrategy,
      hiddenLogLevels,
      logsSortOrder,
      isFlipping,
      showDetectedFields,
      forceEscape,
    } = this.state;

    const styles = getStyles(theme, true); // TODO: JOEY
    const { logsRow, logsRowLocalTime, logsRowMessage } = getLogRowStyles(theme);
    const filteredLogs = this.filterRows(this.rowsToRender(), hiddenLogLevels);
    const { dedupedRows, dedupCount } = this.dedupRows(filteredLogs, dedupStrategy);

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
                  <td className={cx(logsRowMessage)}>{row.hasAnsi ? <LogMessageAnsi value={row.raw} /> : row.entry}</td>
                </tr>
              );
            })}
            <tr
              ref={(element) => {
                this.liveEndDiv = element;
                // This is triggered on every update so on every new row. It keeps the view scrolled at the bottom by
                // default.
                if (this.liveEndDiv && !isPaused) {
                  this.scrollContainerRef.current?.scrollTo(0, this.scrollContainerRef.current.scrollHeight);
                }
              }}
            />
          </tbody>
        </table>
        <div className={styles.logsSection}>
          <div className={styles.logRows}>
            <LogRows
              logRows={this.rowsToRender()}
              deduplicatedRows={dedupedRows}
              dedupStrategy={dedupStrategy}
              getRowContext={this.props.getRowContext}
              onClickFilterLabel={onClickFilterLabel}
              onClickFilterOutLabel={onClickFilterOutLabel}
              showContextToggle={showContextToggle}
              showLabels={showLabels}
              showTime={showTime}
              enableLogDetails={true}
              forceEscape={forceEscape}
              wrapLogMessage={wrapLogMessage}
              prettifyLogMessage={prettifyLogMessage}
              timeZone={timeZone}
              getFieldLinks={getFieldLinks}
              logsSortOrder={logsSortOrder}
              showDetectedFields={showDetectedFields}
              onClickShowDetectedField={this.showDetectedField}
              onClickHideDetectedField={this.hideDetectedField}
            />
          </div>
        </div>
        <div className={styles.logsRowsIndicator}>
          <Button variant="secondary" onClick={isPaused ? onResume : onPause} className={styles.button}>
            <Icon name={isPaused ? 'play' : 'pause'} />
            &nbsp;
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="secondary" onClick={this.props.stopLive} className={styles.button}>
            <Icon name="square-shape" size="lg" type="mono" />
            &nbsp; Exit live mode
          </Button>
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

export const LiveLogsWithTheme = withTheme2(LiveLogs);
