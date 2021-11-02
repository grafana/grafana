import { __makeTemplateObject } from "tslib";
import React from 'react';
import { getAlertTableStyles } from '../../styles/table';
import { useStyles2 } from '@grafana/ui';
import { SilencedAlertsTableRow } from './SilencedAlertsTableRow';
import { css, cx } from '@emotion/css';
var SilencedAlertsTable = function (_a) {
    var silencedAlerts = _a.silencedAlerts;
    var tableStyles = useStyles2(getAlertTableStyles);
    var styles = useStyles2(getStyles);
    if (!!silencedAlerts.length) {
        return (React.createElement("table", { className: cx(tableStyles.table, styles.tableMargin) },
            React.createElement("colgroup", null,
                React.createElement("col", { className: tableStyles.colExpand }),
                React.createElement("col", { className: styles.colState }),
                React.createElement("col", null),
                React.createElement("col", { className: styles.colName }),
                React.createElement("col", null)),
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null),
                    React.createElement("th", null, "State"),
                    React.createElement("th", null),
                    React.createElement("th", null, "Alert name"),
                    React.createElement("th", null, "Actions"))),
            React.createElement("tbody", null, silencedAlerts.map(function (alert, index) {
                return (React.createElement(SilencedAlertsTableRow, { key: alert.fingerprint, alert: alert, className: index % 2 === 0 ? tableStyles.evenRow : '' }));
            }))));
    }
    else {
        return null;
    }
};
var getStyles = function (theme) { return ({
    tableMargin: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing(1)),
    colState: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    width: 110px;\n  "], ["\n    width: 110px;\n  "]))),
    colName: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: 65%;\n  "], ["\n    width: 65%;\n  "]))),
}); };
export default SilencedAlertsTable;
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=SilencedAlertsTable.js.map