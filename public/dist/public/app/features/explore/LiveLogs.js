import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css, cx } from '@emotion/css';
import tinycolor from 'tinycolor2';
import { LogMessageAnsi, getLogRowStyles, Icon, Button, withTheme2 } from '@grafana/ui';
import { dateTimeFormat } from '@grafana/data';
import { ElapsedTime } from './ElapsedTime';
var getStyles = function (theme) { return ({
    logsRowsLive: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: logs-rows-live;\n    font-family: ", ";\n    font-size: ", ";\n    display: flex;\n    flex-flow: column nowrap;\n    height: 60vh;\n    overflow-y: scroll;\n    :first-child {\n      margin-top: auto !important;\n    }\n  "], ["\n    label: logs-rows-live;\n    font-family: ", ";\n    font-size: ", ";\n    display: flex;\n    flex-flow: column nowrap;\n    height: 60vh;\n    overflow-y: scroll;\n    :first-child {\n      margin-top: auto !important;\n    }\n  "])), theme.typography.fontFamilyMonospace, theme.typography.bodySmall.fontSize),
    logsRowFade: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: logs-row-fresh;\n    color: ", ";\n    background-color: ", ";\n    animation: fade 1s ease-out 1s 1 normal forwards;\n    @keyframes fade {\n      from {\n        background-color: ", ";\n      }\n      to {\n        background-color: transparent;\n      }\n    }\n  "], ["\n    label: logs-row-fresh;\n    color: ", ";\n    background-color: ", ";\n    animation: fade 1s ease-out 1s 1 normal forwards;\n    @keyframes fade {\n      from {\n        background-color: ", ";\n      }\n      to {\n        background-color: transparent;\n      }\n    }\n  "])), theme.colors.text, tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString(), tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString()),
    logsRowsIndicator: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    font-size: ", ";\n    padding-top: ", ";\n    display: flex;\n    align-items: center;\n  "], ["\n    font-size: ", ";\n    padding-top: ", ";\n    display: flex;\n    align-items: center;\n  "])), theme.typography.h6.fontSize, theme.spacing(1)),
    button: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing(1)),
    fullWidth: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    width: 100%;\n  "], ["\n    width: 100%;\n  "]))),
}); };
var LiveLogs = /** @class */ (function (_super) {
    __extends(LiveLogs, _super);
    function LiveLogs(props) {
        var _this = _super.call(this, props) || this;
        _this.liveEndDiv = null;
        _this.scrollContainerRef = React.createRef();
        /**
         * Handle pausing when user scrolls up so that we stop resetting his position to the bottom when new row arrives.
         * We do not need to throttle it here much, adding new rows should be throttled/buffered itself in the query epics
         * and after you pause we remove the handler and add it after you manually resume, so this should not be fired often.
         */
        _this.onScroll = function (event) {
            var _a = _this.props, isPaused = _a.isPaused, onPause = _a.onPause;
            var _b = event.currentTarget, scrollTop = _b.scrollTop, clientHeight = _b.clientHeight, scrollHeight = _b.scrollHeight;
            var distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
            if (distanceFromBottom >= 5 && !isPaused) {
                onPause();
            }
        };
        _this.rowsToRender = function () {
            var isPaused = _this.props.isPaused;
            var _a = _this.state.logRowsToRender, rowsToRender = _a === void 0 ? [] : _a;
            if (!isPaused) {
                // A perf optimisation here. Show just 100 rows when streaming and full length when the streaming is paused.
                rowsToRender = rowsToRender.slice(-100);
            }
            return rowsToRender;
        };
        _this.state = {
            logRowsToRender: props.logRows,
        };
        return _this;
    }
    LiveLogs.getDerivedStateFromProps = function (nextProps, state) {
        if (!nextProps.isPaused) {
            return {
                // We update what we show only if not paused. We keep any background subscriptions running and keep updating
                // our state, but we do not show the updates, this allows us start again showing correct result after resuming
                // without creating a gap in the log results.
                logRowsToRender: nextProps.logRows,
            };
        }
        else {
            return null;
        }
    };
    LiveLogs.prototype.render = function () {
        var _this = this;
        var _a = this.props, theme = _a.theme, timeZone = _a.timeZone, onPause = _a.onPause, onResume = _a.onResume, isPaused = _a.isPaused;
        var styles = getStyles(theme);
        var _b = getLogRowStyles(theme), logsRow = _b.logsRow, logsRowLocalTime = _b.logsRowLocalTime, logsRowMessage = _b.logsRowMessage;
        return (React.createElement("div", null,
            React.createElement("table", { className: styles.fullWidth },
                React.createElement("tbody", { onScroll: isPaused ? undefined : this.onScroll, className: cx(['logs-rows', styles.logsRowsLive]), ref: this.scrollContainerRef },
                    this.rowsToRender().map(function (row) {
                        return (React.createElement("tr", { className: cx(logsRow, styles.logsRowFade), key: row.uid },
                            React.createElement("td", { className: cx(logsRowLocalTime) }, dateTimeFormat(row.timeEpochMs, { timeZone: timeZone })),
                            React.createElement("td", { className: cx(logsRowMessage) }, row.hasAnsi ? React.createElement(LogMessageAnsi, { value: row.raw }) : row.entry)));
                    }),
                    React.createElement("tr", { ref: function (element) {
                            var _a;
                            _this.liveEndDiv = element;
                            // This is triggered on every update so on every new row. It keeps the view scrolled at the bottom by
                            // default.
                            if (_this.liveEndDiv && !isPaused) {
                                (_a = _this.scrollContainerRef.current) === null || _a === void 0 ? void 0 : _a.scrollTo(0, _this.scrollContainerRef.current.scrollHeight);
                            }
                        } }))),
            React.createElement("div", { className: styles.logsRowsIndicator },
                React.createElement(Button, { variant: "secondary", onClick: isPaused ? onResume : onPause, className: styles.button },
                    React.createElement(Icon, { name: isPaused ? 'play' : 'pause' }),
                    "\u00A0",
                    isPaused ? 'Resume' : 'Pause'),
                React.createElement(Button, { variant: "secondary", onClick: this.props.stopLive, className: styles.button },
                    React.createElement(Icon, { name: "square-shape", size: "lg", type: "mono" }),
                    "\u00A0 Exit live mode"),
                isPaused || (React.createElement("span", null,
                    "Last line received: ",
                    React.createElement(ElapsedTime, { resetKey: this.props.logRows, humanize: true }),
                    " ago")))));
    };
    return LiveLogs;
}(PureComponent));
export var LiveLogsWithTheme = withTheme2(LiveLogs);
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=LiveLogs.js.map