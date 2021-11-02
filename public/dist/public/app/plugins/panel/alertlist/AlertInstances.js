import { __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { Icon, useStyles2 } from '@grafana/ui';
import { AlertLabels } from 'app/features/alerting/unified/components/AlertLabels';
import { AlertStateTag } from 'app/features/alerting/unified/components/rules/AlertStateTag';
import { dateTime } from '@grafana/data';
import { css } from '@emotion/css';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { omit } from 'lodash';
import { alertInstanceKey } from 'app/features/alerting/unified/utils/rules';
export var AlertInstances = function (_a) {
    var ruleWithLocation = _a.ruleWithLocation, showInstances = _a.showInstances;
    var rule = ruleWithLocation.rule;
    var _b = __read(useState(showInstances), 2), displayInstances = _b[0], setDisplayInstances = _b[1];
    var styles = useStyles2(getStyles);
    useEffect(function () {
        setDisplayInstances(showInstances);
    }, [showInstances]);
    // sort instances, because API returns them in random order every time
    var sortedAlerts = useMemo(function () {
        return displayInstances
            ? rule.alerts.slice().sort(function (a, b) { return alertInstanceKey(a).localeCompare(alertInstanceKey(b)); })
            : [];
    }, [rule, displayInstances]);
    return (React.createElement("div", null,
        rule.state !== PromAlertingRuleState.Inactive && (React.createElement("div", { className: styles.instance, onClick: function () { return setDisplayInstances(!displayInstances); } },
            React.createElement(Icon, { name: displayInstances ? 'angle-down' : 'angle-right', size: 'md' }),
            React.createElement("span", null, rule.alerts.length + " " + pluralize('instance', rule.alerts.length)))),
        !!sortedAlerts.length && (React.createElement("ol", { className: styles.list }, sortedAlerts.map(function (alert, index) {
            return (React.createElement("li", { className: styles.listItem, key: alert.activeAt + "-" + index },
                React.createElement("div", null,
                    React.createElement(AlertStateTag, { state: alert.state }),
                    React.createElement("span", { className: styles.date }, dateTime(alert.activeAt).format('YYYY-MM-DD HH:mm:ss'))),
                React.createElement(AlertLabels, { labels: omit(alert.labels, 'alertname') })));
        })))));
};
var getStyles = function (theme) { return ({
    instance: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    cursor: pointer;\n  "], ["\n    cursor: pointer;\n  "]))),
    list: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    list-style-type: none;\n  "], ["\n    list-style-type: none;\n  "]))),
    listItem: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(1)),
    date: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    font-size: ", ";\n    padding-left: ", ";\n  "], ["\n    font-size: ", ";\n    padding-left: ", ";\n  "])), theme.typography.bodySmall.fontSize, theme.spacing(0.5)),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=AlertInstances.js.map