import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import tinycolor from 'tinycolor2';
import { dateTimeFormat, LogsSortOrder } from '@grafana/data';
import { Button, withTheme2 } from '@grafana/ui';
import { LogMessageAnsi } from '../../logs/components/LogMessageAnsi';
import { getLogRowStyles } from '../../logs/components/getLogRowStyles';
import { sortLogRows } from '../../logs/utils';
import { ElapsedTime } from '../ElapsedTime';
import { filterLogRowsByIndex } from '../state/utils';
const getStyles = (theme) => ({
    logsRowsLive: css `
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
    logsRowFade: css `
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
    logsRowsIndicator: css `
    font-size: ${theme.typography.h6.fontSize};
    padding-top: ${theme.spacing(1)};
    display: flex;
    align-items: center;
  `,
    button: css `
    margin-right: ${theme.spacing(1)};
  `,
    fullWidth: css `
    width: 100%;
  `,
});
class LiveLogs extends PureComponent {
    constructor(props) {
        super(props);
        this.liveEndDiv = null;
        this.scrollContainerRef = React.createRef();
        /**
         * Handle pausing when user scrolls up so that we stop resetting his position to the bottom when new row arrives.
         * We do not need to throttle it here much, adding new rows should be throttled/buffered itself in the query epics
         * and after you pause we remove the handler and add it after you manually resume, so this should not be fired often.
         */
        this.onScroll = (event) => {
            const { isPaused, onPause } = this.props;
            const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
            const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
            if (distanceFromBottom >= 5 && !isPaused) {
                onPause();
            }
        };
        this.rowsToRender = () => {
            const { isPaused } = this.props;
            let { logRowsToRender: rowsToRender = [] } = this.state;
            if (!isPaused) {
                // A perf optimisation here. Show just 100 rows when streaming and full length when the streaming is paused.
                rowsToRender = sortLogRows(rowsToRender, LogsSortOrder.Ascending).slice(-100);
            }
            return rowsToRender;
        };
        this.state = {
            logRowsToRender: props.logRows,
        };
    }
    static getDerivedStateFromProps(nextProps, state) {
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
    render() {
        const { theme, timeZone, onPause, onResume, onClear, isPaused } = this.props;
        const styles = getStyles(theme);
        const { logsRow, logsRowLocalTime, logsRowMessage } = getLogRowStyles(theme);
        return (React.createElement("div", null,
            React.createElement("table", { className: styles.fullWidth },
                React.createElement("tbody", { onScroll: isPaused ? undefined : this.onScroll, className: styles.logsRowsLive, ref: this.scrollContainerRef },
                    this.rowsToRender().map((row) => {
                        return (React.createElement("tr", { className: cx(logsRow, styles.logsRowFade), key: row.uid },
                            React.createElement("td", { className: logsRowLocalTime }, dateTimeFormat(row.timeEpochMs, { timeZone })),
                            React.createElement("td", { className: logsRowMessage }, row.hasAnsi ? React.createElement(LogMessageAnsi, { value: row.raw }) : row.entry)));
                    }),
                    React.createElement("tr", { ref: (element) => {
                            var _a, _b;
                            this.liveEndDiv = element;
                            // This is triggered on every update so on every new row. It keeps the view scrolled at the bottom by
                            // default.
                            // As scrollTo is not implemented in JSDOM it needs to be part of the condition
                            if (this.liveEndDiv && ((_a = this.scrollContainerRef.current) === null || _a === void 0 ? void 0 : _a.scrollTo) && !isPaused) {
                                (_b = this.scrollContainerRef.current) === null || _b === void 0 ? void 0 : _b.scrollTo(0, this.scrollContainerRef.current.scrollHeight);
                            }
                        } }))),
            React.createElement("div", { className: styles.logsRowsIndicator },
                React.createElement(Button, { icon: isPaused ? 'play' : 'pause', variant: "secondary", onClick: isPaused ? onResume : onPause, className: styles.button }, isPaused ? 'Resume' : 'Pause'),
                React.createElement(Button, { icon: "trash-alt", variant: "secondary", onClick: onClear, className: styles.button }, "Clear logs"),
                React.createElement(Button, { icon: "square-shape", variant: "secondary", onClick: this.props.stopLive, className: styles.button }, "Exit live mode"),
                isPaused ||
                    (this.rowsToRender().length > 0 && (React.createElement("span", null,
                        "Last line received: ",
                        React.createElement(ElapsedTime, { resetKey: this.props.logRows, humanize: true }),
                        " ago"))))));
    }
}
export const LiveLogsWithTheme = withTheme2(LiveLogs);
//# sourceMappingURL=LiveLogs.js.map