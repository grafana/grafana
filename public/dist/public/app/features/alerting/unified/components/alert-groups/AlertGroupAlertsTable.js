import { __makeTemplateObject } from "tslib";
import React, { useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { css } from '@emotion/css';
import { AmAlertStateTag } from '../silences/AmAlertStateTag';
import { AlertLabels } from '../AlertLabels';
import { DynamicTableWithGuidelines } from '../DynamicTableWithGuidelines';
import { AlertDetails } from './AlertDetails';
export var AlertGroupAlertsTable = function (_a) {
    var alerts = _a.alerts, alertManagerSourceName = _a.alertManagerSourceName;
    var styles = useStyles2(getStyles);
    var columns = useMemo(function () { return [
        {
            id: 'state',
            label: 'State',
            // eslint-disable-next-line react/display-name
            renderCell: function (_a) {
                var alert = _a.data;
                return (React.createElement(React.Fragment, null,
                    React.createElement(AmAlertStateTag, { state: alert.status.state }),
                    React.createElement("span", { className: styles.duration },
                        "for",
                        ' ',
                        intervalToAbbreviatedDurationString({
                            start: new Date(alert.startsAt),
                            end: new Date(alert.endsAt),
                        }))));
            },
            size: '190px',
        },
        {
            id: 'labels',
            label: 'Labels',
            // eslint-disable-next-line react/display-name
            renderCell: function (_a) {
                var labels = _a.data.labels;
                return React.createElement(AlertLabels, { className: styles.labels, labels: labels });
            },
            size: 1,
        },
    ]; }, [styles]);
    var items = useMemo(function () {
        return alerts.map(function (alert) { return ({
            id: alert.fingerprint,
            data: alert,
        }); });
    }, [alerts]);
    return (React.createElement("div", { className: styles.tableWrapper, "data-testid": "alert-group-table" },
        React.createElement(DynamicTableWithGuidelines, { cols: columns, items: items, isExpandable: true, renderExpandedContent: function (_a) {
                var alert = _a.data;
                return (React.createElement(AlertDetails, { alert: alert, alertManagerSourceName: alertManagerSourceName }));
            } })));
};
var getStyles = function (theme) { return ({
    tableWrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n    ", " {\n      margin-left: ", ";\n    }\n  "], ["\n    margin-top: ", ";\n    ", " {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(3), theme.breakpoints.up('md'), theme.spacing(4.5)),
    duration: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-left: ", ";\n    font-size: ", ";\n  "], ["\n    margin-left: ", ";\n    font-size: ", ";\n  "])), theme.spacing(1), theme.typography.bodySmall.fontSize),
    labels: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    padding-bottom: 0;\n  "], ["\n    padding-bottom: 0;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=AlertGroupAlertsTable.js.map