import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { dateTimeFormat, checkLogsError, escapeUnescapedString, } from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { cx, css } from '@emotion/css';
import { LogRowContextProvider, } from './LogRowContextProvider';
import { styleMixins, withTheme2 } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
//Components
import { LogDetails } from './LogDetails';
import { LogRowMessageDetectedFields } from './LogRowMessageDetectedFields';
import { LogRowMessage } from './LogRowMessage';
import { LogLabels } from './LogLabels';
var getStyles = function (theme) {
    return {
        topVerticalAlign: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: topVerticalAlign;\n      vertical-align: top;\n      margin-top: -", ";\n      margin-left: -", ";\n    "], ["\n      label: topVerticalAlign;\n      vertical-align: top;\n      margin-top: -", ";\n      margin-left: -", ";\n    "])), theme.spacing(0.5), theme.spacing(0.25)),
        detailsOpen: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      &:hover {\n        background-color: ", ";\n      }\n    "], ["\n      &:hover {\n        background-color: ", ";\n      }\n    "])), styleMixins.hoverColor(theme.colors.background.primary, theme)),
        errorLogRow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: erroredLogRow;\n      color: ", ";\n    "], ["\n      label: erroredLogRow;\n      color: ", ";\n    "])), theme.colors.text.secondary),
    };
};
/**
 * Renders a log line.
 *
 * When user hovers over it for a certain time, it lazily parses the log line.
 * Once a parser is found, it will determine fields, that will be highlighted.
 * When the user requests stats for a field, they will be calculated and rendered below the row.
 */
var UnThemedLogRow = /** @class */ (function (_super) {
    __extends(UnThemedLogRow, _super);
    function UnThemedLogRow() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            showContext: false,
            showDetails: false,
        };
        _this.toggleContext = function () {
            _this.setState(function (state) {
                return {
                    showContext: !state.showContext,
                };
            });
        };
        _this.toggleDetails = function () {
            if (!_this.props.enableLogDetails) {
                return;
            }
            _this.setState(function (state) {
                return {
                    showDetails: !state.showDetails,
                };
            });
        };
        return _this;
    }
    UnThemedLogRow.prototype.renderTimeStamp = function (epochMs) {
        return dateTimeFormat(epochMs, {
            timeZone: this.props.timeZone,
        });
    };
    UnThemedLogRow.prototype.renderLogRow = function (context, errors, hasMoreContextRows, updateLimit) {
        var _a, _b;
        var _c = this.props, getRows = _c.getRows, onClickFilterLabel = _c.onClickFilterLabel, onClickFilterOutLabel = _c.onClickFilterOutLabel, onClickShowDetectedField = _c.onClickShowDetectedField, onClickHideDetectedField = _c.onClickHideDetectedField, enableLogDetails = _c.enableLogDetails, row = _c.row, showDuplicates = _c.showDuplicates, showContextToggle = _c.showContextToggle, showLabels = _c.showLabels, showTime = _c.showTime, showDetectedFields = _c.showDetectedFields, wrapLogMessage = _c.wrapLogMessage, prettifyLogMessage = _c.prettifyLogMessage, theme = _c.theme, getFieldLinks = _c.getFieldLinks, forceEscape = _c.forceEscape, onLogRowHover = _c.onLogRowHover;
        var _d = this.state, showDetails = _d.showDetails, showContext = _d.showContext;
        var style = getLogRowStyles(theme, row.logLevel);
        var styles = getStyles(theme);
        var _e = checkLogsError(row), errorMessage = _e.errorMessage, hasError = _e.hasError;
        var logRowBackground = cx(style.logsRow, (_a = {},
            _a[styles.errorLogRow] = hasError,
            _a));
        var processedRow = row.hasUnescapedContent && forceEscape
            ? __assign(__assign({}, row), { entry: escapeUnescapedString(row.entry), raw: escapeUnescapedString(row.raw) }) : row;
        return (React.createElement(React.Fragment, null,
            React.createElement("tr", { className: logRowBackground, onClick: this.toggleDetails, onMouseEnter: function () {
                    onLogRowHover && onLogRowHover(row);
                }, onMouseLeave: function () {
                    onLogRowHover && onLogRowHover(undefined);
                } },
                showDuplicates && (React.createElement("td", { className: style.logsRowDuplicates }, processedRow.duplicates && processedRow.duplicates > 0 ? processedRow.duplicates + 1 + "x" : null)),
                React.createElement("td", { className: cx((_b = {}, _b[style.logsRowLevel] = !hasError, _b)) }, hasError && (React.createElement(Tooltip, { content: "Error: " + errorMessage, placement: "right", theme: "error" },
                    React.createElement(Icon, { className: style.logIconError, name: "exclamation-triangle", size: "xs" })))),
                enableLogDetails && (React.createElement("td", { title: showDetails ? 'Hide log details' : 'See log details', className: style.logsRowToggleDetails },
                    React.createElement(Icon, { className: styles.topVerticalAlign, name: showDetails ? 'angle-down' : 'angle-right' }))),
                showTime && React.createElement("td", { className: style.logsRowLocalTime }, this.renderTimeStamp(row.timeEpochMs)),
                showLabels && processedRow.uniqueLabels && (React.createElement("td", { className: style.logsRowLabels },
                    React.createElement(LogLabels, { labels: processedRow.uniqueLabels }))),
                showDetectedFields && showDetectedFields.length > 0 ? (React.createElement(LogRowMessageDetectedFields, { row: processedRow, showDetectedFields: showDetectedFields, getFieldLinks: getFieldLinks, wrapLogMessage: wrapLogMessage })) : (React.createElement(LogRowMessage, { row: processedRow, getRows: getRows, errors: errors, hasMoreContextRows: hasMoreContextRows, updateLimit: updateLimit, context: context, contextIsOpen: showContext, showContextToggle: showContextToggle, wrapLogMessage: wrapLogMessage, prettifyLogMessage: prettifyLogMessage, onToggleContext: this.toggleContext }))),
            this.state.showDetails && (React.createElement(LogDetails, { className: logRowBackground, showDuplicates: showDuplicates, getFieldLinks: getFieldLinks, onClickFilterLabel: onClickFilterLabel, onClickFilterOutLabel: onClickFilterOutLabel, onClickShowDetectedField: onClickShowDetectedField, onClickHideDetectedField: onClickHideDetectedField, getRows: getRows, row: processedRow, wrapLogMessage: wrapLogMessage, hasError: hasError, showDetectedFields: showDetectedFields }))));
    };
    UnThemedLogRow.prototype.render = function () {
        var _this = this;
        var showContext = this.state.showContext;
        var _a = this.props, logsSortOrder = _a.logsSortOrder, row = _a.row, getRowContext = _a.getRowContext;
        if (showContext) {
            return (React.createElement(React.Fragment, null,
                React.createElement(LogRowContextProvider, { row: row, getRowContext: getRowContext, logsSortOrder: logsSortOrder }, function (_a) {
                    var result = _a.result, errors = _a.errors, hasMoreContextRows = _a.hasMoreContextRows, updateLimit = _a.updateLimit;
                    return React.createElement(React.Fragment, null, _this.renderLogRow(result, errors, hasMoreContextRows, updateLimit));
                })));
        }
        return this.renderLogRow();
    };
    return UnThemedLogRow;
}(PureComponent));
export var LogRow = withTheme2(UnThemedLogRow);
LogRow.displayName = 'LogRow';
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=LogRow.js.map