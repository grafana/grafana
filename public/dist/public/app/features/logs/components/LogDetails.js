import { cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { withTheme2 } from '@grafana/ui';
import { calculateLogsLabelStats, calculateStats } from '../utils';
import { LogDetailsRow } from './LogDetailsRow';
import { getLogLevelStyles } from './getLogRowStyles';
import { getAllFields, createLogLineLinks } from './logParser';
class UnThemedLogDetails extends PureComponent {
    render() {
        const { app, row, theme, hasError, onClickFilterOutLabel, onClickFilterLabel, getRows, showDuplicates, className, onClickShowField, onClickHideField, displayedFields, getFieldLinks, wrapLogMessage, styles, } = this.props;
        const levelStyles = getLogLevelStyles(theme, row.logLevel);
        const labels = row.labels ? row.labels : {};
        const labelsAvailable = Object.keys(labels).length > 0;
        const fieldsAndLinks = getAllFields(row, getFieldLinks);
        let fieldsWithLinks = fieldsAndLinks.filter((f) => { var _a; return (_a = f.links) === null || _a === void 0 ? void 0 : _a.length; });
        const displayedFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex !== row.entryFieldIndex).sort();
        const hiddenFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex === row.entryFieldIndex).sort();
        const fieldsWithLinksFromVariableMap = createLogLineLinks(hiddenFieldsWithLinks);
        // do not show the log message unless there is a link attached
        const fields = fieldsAndLinks.filter((f) => { var _a; return ((_a = f.links) === null || _a === void 0 ? void 0 : _a.length) === 0 && f.fieldIndex !== row.entryFieldIndex; }).sort();
        const fieldsAvailable = fields && fields.length > 0;
        const fieldsWithLinksAvailable = (displayedFieldsWithLinks && displayedFieldsWithLinks.length > 0) ||
            (fieldsWithLinksFromVariableMap && fieldsWithLinksFromVariableMap.length > 0);
        // If logs with error, we are not showing the level color
        const levelClassName = hasError
            ? ''
            : `${levelStyles.logsRowLevelColor} ${styles.logsRowLevel} ${styles.logsRowLevelDetails}`;
        return (React.createElement("tr", { className: cx(className, styles.logDetails) },
            showDuplicates && React.createElement("td", null),
            React.createElement("td", { className: levelClassName, "aria-label": "Log level" }),
            React.createElement("td", { colSpan: 4 },
                React.createElement("div", { className: styles.logDetailsContainer },
                    React.createElement("table", { className: styles.logDetailsTable },
                        React.createElement("tbody", null,
                            (labelsAvailable || fieldsAvailable) && (React.createElement("tr", null,
                                React.createElement("td", { colSpan: 100, className: styles.logDetailsHeading, "aria-label": "Fields" }, "Fields"))),
                            Object.keys(labels)
                                .sort()
                                .map((key, i) => {
                                const value = labels[key];
                                return (React.createElement(LogDetailsRow, { key: `${key}=${value}-${i}`, parsedKeys: [key], parsedValues: [value], isLabel: true, getStats: () => calculateLogsLabelStats(getRows(), key), onClickFilterOutLabel: onClickFilterOutLabel, onClickFilterLabel: onClickFilterLabel, onClickShowField: onClickShowField, onClickHideField: onClickHideField, row: row, app: app, wrapLogMessage: wrapLogMessage, displayedFields: displayedFields, disableActions: false, isFilterLabelActive: this.props.isFilterLabelActive }));
                            }),
                            fields.map((field, i) => {
                                const { keys, values, fieldIndex } = field;
                                return (React.createElement(LogDetailsRow, { key: `${keys[0]}=${values[0]}-${i}`, parsedKeys: keys, parsedValues: values, onClickShowField: onClickShowField, onClickHideField: onClickHideField, onClickFilterOutLabel: onClickFilterOutLabel, onClickFilterLabel: onClickFilterLabel, getStats: () => calculateStats(row.dataFrame.fields[fieldIndex].values), displayedFields: displayedFields, wrapLogMessage: wrapLogMessage, row: row, app: app, disableActions: false, isFilterLabelActive: this.props.isFilterLabelActive }));
                            }),
                            fieldsWithLinksAvailable && (React.createElement("tr", null,
                                React.createElement("td", { colSpan: 100, className: styles.logDetailsHeading, "aria-label": "Data Links" }, "Links"))),
                            displayedFieldsWithLinks.map((field, i) => {
                                const { keys, values, links, fieldIndex } = field;
                                return (React.createElement(LogDetailsRow, { key: `${keys[0]}=${values[0]}-${i}`, parsedKeys: keys, parsedValues: values, links: links, onClickShowField: onClickShowField, onClickHideField: onClickHideField, getStats: () => calculateStats(row.dataFrame.fields[fieldIndex].values), displayedFields: displayedFields, wrapLogMessage: wrapLogMessage, row: row, app: app, disableActions: false }));
                            }), fieldsWithLinksFromVariableMap === null || fieldsWithLinksFromVariableMap === void 0 ? void 0 :
                            fieldsWithLinksFromVariableMap.map((field, i) => {
                                const { keys, values, links, fieldIndex } = field;
                                return (React.createElement(LogDetailsRow, { key: `${keys[0]}=${values[0]}-${i}`, parsedKeys: keys, parsedValues: values, links: links, onClickShowField: onClickShowField, onClickHideField: onClickHideField, getStats: () => calculateStats(row.dataFrame.fields[fieldIndex].values), displayedFields: displayedFields, wrapLogMessage: wrapLogMessage, row: row, app: app, disableActions: true }));
                            }),
                            !fieldsAvailable && !labelsAvailable && !fieldsWithLinksAvailable && (React.createElement("tr", null,
                                React.createElement("td", { colSpan: 100, "aria-label": "No details" }, "No details available")))))))));
    }
}
export const LogDetails = withTheme2(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
//# sourceMappingURL=LogDetails.js.map