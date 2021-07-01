import React, { ChangeEvent, PureComponent } from 'react';
import { css, cx } from '@emotion/css';
import tinycolor from 'tinycolor2';

import { LogMessageAnsi, getLogRowStyles, Icon, Button, Themeable2, withTheme2, Input, Select } from '@grafana/ui';
import { LogRowModel, TimeZone, dateTimeFormat, GrafanaTheme2, LogLevel, SelectableValue } from '@grafana/data';

import { ElapsedTime } from './ElapsedTime';
import Sonifier, { Tuple } from 'app/core/services/Sonifier';

const LevelMapper = {
  [LogLevel.unknown]: 'A',
  [LogLevel.trace]: 'A',
  [LogLevel.debug]: 'A',
  [LogLevel.info]: 'A',
  [LogLevel.error]: 'C',
  [LogLevel.warning]: 'E',
  [LogLevel.critical]: 'G',
};

const Levels: SelectableValue[] = [
  LogLevel.trace,
  LogLevel.debug,
  LogLevel.info,
  LogLevel.error,
  LogLevel.warning,
  LogLevel.critical,
].map((level) => ({ label: level, value: level }));

const getStyles = (theme: GrafanaTheme2) => ({
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
  logsRowSonified: css`
    color: ${theme.v1.colors.textStrong};
    background-color: ${tinycolor(theme.v1.palette.red88).setAlpha(0.33).toString()};
    animation: none;
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
});

export interface Props extends Themeable2 {
  logRows?: LogRowModel[];
  timeZone: TimeZone;
  stopLive: () => void;
  onPause: () => void;
  onResume: () => void;
  isPaused: boolean;
}

interface State {
  logRowsToRender?: LogRowModel[];
  sonify: boolean;
  sonifyValue: boolean;
  sonifyValueExpression: string;
  sonifyValueMatcher?: RegExp;
  sonifyValueMax: string;
  sonifyLevelMin: string;
}

class LiveLogs extends PureComponent<Props, State> {
  private liveEndDiv: HTMLDivElement | null = null;
  private scrollContainerRef = React.createRef<HTMLTableSectionElement>();
  private rowsCheckedForSonification: any = {};
  private rowsSonified: any = {};
  private sonifier: Sonifier;

  constructor(props: Props) {
    super(props);
    this.state = {
      logRowsToRender: props.logRows,
      sonify: false,
      sonifyValue: false,
      sonifyValueExpression: '',
      sonifyValueMax: '',
      sonifyLevelMin: LogLevel.error,
    };
    this.sonifier = new Sonifier();
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

  componentDidUpdate() {
    const { sonify, sonifyValue, sonifyLevelMin, sonifyValueMatcher, logRowsToRender = [] } = this.state;
    if ((sonify || sonifyValue) && !this.props.isPaused) {
      // HACK to not run out of memory
      if (Object.keys(this.rowsCheckedForSonification).length > 1e6) {
        this.rowsCheckedForSonification = {};
        this.rowsSonified = {};
      }
      const series: Tuple[] = [];
      for (const row of logRowsToRender) {
        if (!this.rowsCheckedForSonification[row.uid]) {
          if (sonify && LevelMapper[row.logLevel] >= LevelMapper[sonifyLevelMin as LogLevel]) {
            this.sonifier.playNote(LevelMapper[row.logLevel], 200);
            this.rowsSonified[row.uid] = true;
          } else if (sonifyValue && sonifyValueMatcher) {
            const match = row.entry.match(sonifyValueMatcher);
            if (match) {
              try {
                const value = parseFloat(match[0]);
                series.push([row.timeEpochMs, value]);
                this.rowsSonified[row.uid] = true;
              } catch (error) {}
            }
          }
        }
        this.rowsCheckedForSonification[row.uid] = true;
      }
      this.sonifier.playSeries(series);
    }
  }

  onChangeValueMax = (event: ChangeEvent<HTMLInputElement>) => {
    const sonifyValueMax = event.target.value;
    try {
      const max = parseFloat(sonifyValueMax);
      if (max && max > 0) {
        // TODO reset scale
        console.log('reset scale, new max value', max);
      }
    } catch (error) {}
    this.setState({ sonifyValueMax });
  };

  onChangeValueExpression = (event: ChangeEvent<HTMLInputElement>) => {
    const sonifyValueExpression = event.target.value;
    let sonifyValueMatcher;
    try {
      if (sonifyValueExpression.match(/\(.+\)/)) {
        sonifyValueMatcher = new RegExp(event.target.value);
      }
    } catch (error) {}
    this.setState({ sonifyValueMatcher, sonifyValueExpression });
  };

  onClickSonify = () => {
    // Stop if currently playing
    if (this.state.sonify) {
      this.sonifier.stop();
    }
    this.setState((state) => ({ sonify: !state.sonify }));
  };

  onClickSonifyValue = () => {
    // Stop if currently playing
    if (this.state.sonifyValue) {
      this.sonifier.stop();
    }
    this.setState((state) => ({ sonifyValue: !state.sonifyValue }));
  };

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

  onSelectSonifyLevel = (value: SelectableValue<string>) => {
    this.setState({ sonifyLevelMin: value.value || LogLevel.error });
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
    const { sonify, sonifyValue, sonifyValueExpression, sonifyValueMax, sonifyLevelMin } = this.state;
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
                <tr
                  className={cx(logsRow, styles.logsRowFade, this.rowsSonified[row.uid] && styles.logsRowSonified)}
                  key={row.uid}
                >
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
          <Button variant="secondary" onClick={this.onClickSonify} className={styles.button}>
            <Icon name="bell" />
            &nbsp; {sonify ? 'Stop level sound' : 'Sonify log level'}
          </Button>
          {sonify && (
            <Select
              value={sonifyLevelMin}
              options={Levels}
              onChange={this.onSelectSonifyLevel}
              menuPlacement="top"
              width={12}
            />
          )}
          <Button variant="secondary" onClick={this.onClickSonifyValue} className={styles.button}>
            <Icon name="bell" />
            &nbsp; {sonifyValue ? 'Stop value sound' : 'Sonify value'}
          </Button>
          {sonifyValue && (
            <>
              <Input
                width={48}
                placeholder="Example: duration=(\d+)ms"
                onChange={this.onChangeValueExpression}
                value={sonifyValueExpression}
              />
              <Input width={12} placeholder="Max value" onChange={this.onChangeValueMax} value={sonifyValueMax} />
            </>
          )}
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
