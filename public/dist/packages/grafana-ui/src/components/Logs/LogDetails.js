import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import memoizeOne from 'memoize-one';
import { css, cx } from '@emotion/css';
import { calculateFieldStats, calculateLogsLabelStats, calculateStats, getParser, } from '@grafana/data';
import { withTheme2 } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { getAllFields } from './logParser';
//Components
import { LogDetailsRow } from './LogDetailsRow';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
var getStyles = function (theme) {
    return {
        logsRowLevelDetails: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: logs-row__level_details;\n      &::after {\n        top: -3px;\n      }\n    "], ["\n      label: logs-row__level_details;\n      &::after {\n        top: -3px;\n      }\n    "]))),
        logDetails: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: logDetailsDefaultCursor;\n      cursor: default;\n\n      &:hover {\n        background-color: ", ";\n      }\n    "], ["\n      label: logDetailsDefaultCursor;\n      cursor: default;\n\n      &:hover {\n        background-color: ", ";\n      }\n    "])), theme.colors.background.primary),
    };
};
var UnThemedLogDetails = /** @class */ (function (_super) {
    __extends(UnThemedLogDetails, _super);
    function UnThemedLogDetails() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.getParser = memoizeOne(getParser);
        _this.getStatsForDetectedField = function (key) {
            var matcher = _this.getParser(_this.props.row.entry).buildMatcher(key);
            return calculateFieldStats(_this.props.getRows(), matcher);
        };
        return _this;
    }
    UnThemedLogDetails.prototype.render = function () {
        var _this = this;
        var _a = this.props, row = _a.row, theme = _a.theme, hasError = _a.hasError, onClickFilterOutLabel = _a.onClickFilterOutLabel, onClickFilterLabel = _a.onClickFilterLabel, getRows = _a.getRows, showDuplicates = _a.showDuplicates, className = _a.className, onClickShowDetectedField = _a.onClickShowDetectedField, onClickHideDetectedField = _a.onClickHideDetectedField, showDetectedFields = _a.showDetectedFields, getFieldLinks = _a.getFieldLinks, wrapLogMessage = _a.wrapLogMessage;
        var style = getLogRowStyles(theme, row.logLevel);
        var styles = getStyles(theme);
        var labels = row.labels ? row.labels : {};
        var labelsAvailable = Object.keys(labels).length > 0;
        var fields = getAllFields(row, getFieldLinks);
        var detectedFieldsAvailable = fields && fields.length > 0;
        // If logs with error, we are not showing the level color
        var levelClassName = cx(!hasError && [style.logsRowLevel, styles.logsRowLevelDetails]);
        return (React.createElement("tr", { className: cx(className, styles.logDetails) },
            showDuplicates && React.createElement("td", null),
            React.createElement("td", { className: levelClassName, "aria-label": "Log level" }),
            React.createElement("td", { colSpan: 4 },
                React.createElement("div", { className: style.logDetailsContainer },
                    React.createElement("table", { className: style.logDetailsTable },
                        React.createElement("tbody", null,
                            labelsAvailable && (React.createElement("tr", null,
                                React.createElement("td", { colSpan: 5, className: style.logDetailsHeading, "aria-label": "Log labels" }, "Log labels"))),
                            Object.keys(labels)
                                .sort()
                                .map(function (key) {
                                var value = labels[key];
                                return (React.createElement(LogDetailsRow, { key: key + "=" + value, parsedKey: key, parsedValue: value, isLabel: true, getStats: function () { return calculateLogsLabelStats(getRows(), key); }, onClickFilterOutLabel: onClickFilterOutLabel, onClickFilterLabel: onClickFilterLabel }));
                            }),
                            detectedFieldsAvailable && (React.createElement("tr", null,
                                React.createElement("td", { colSpan: 5, className: style.logDetailsHeading, "aria-label": "Detected fields" },
                                    "Detected fields",
                                    React.createElement(Tooltip, { content: "Fields that are parsed from log message and detected by Grafana." },
                                        React.createElement(Icon, { name: "question-circle", size: "xs", className: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n                            margin-left: 4px;\n                          "], ["\n                            margin-left: 4px;\n                          "]))) }))))),
                            fields.sort().map(function (field) {
                                var key = field.key, value = field.value, links = field.links, fieldIndex = field.fieldIndex;
                                return (React.createElement(LogDetailsRow, { key: key + "=" + value, parsedKey: key, parsedValue: value, links: links, onClickShowDetectedField: onClickShowDetectedField, onClickHideDetectedField: onClickHideDetectedField, getStats: function () {
                                        return fieldIndex === undefined
                                            ? _this.getStatsForDetectedField(key)
                                            : calculateStats(row.dataFrame.fields[fieldIndex].values.toArray());
                                    }, showDetectedFields: showDetectedFields, wrapLogMessage: wrapLogMessage }));
                            }),
                            !detectedFieldsAvailable && !labelsAvailable && (React.createElement("tr", null,
                                React.createElement("td", { colSpan: 5, "aria-label": "No details" }, "No details available")))))))));
    };
    return UnThemedLogDetails;
}(PureComponent));
export var LogDetails = withTheme2(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=LogDetails.js.map