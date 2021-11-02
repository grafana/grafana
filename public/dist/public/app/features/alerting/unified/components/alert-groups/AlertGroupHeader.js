import { __read } from "tslib";
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getNotificationsTextColors } from '../../styles/notifications';
import pluralize from 'pluralize';
export var AlertGroupHeader = function (_a) {
    var group = _a.group;
    var textStyles = useStyles2(getNotificationsTextColors);
    var total = group.alerts.length;
    var countByStatus = group.alerts.reduce(function (statusObj, alert) {
        if (statusObj[alert.status.state]) {
            statusObj[alert.status.state] += 1;
        }
        else {
            statusObj[alert.status.state] = 1;
        }
        return statusObj;
    }, {});
    return (React.createElement("div", null, total + " " + pluralize('alert', total) + ": ",
        Object.entries(countByStatus).map(function (_a, index) {
            var _b = __read(_a, 2), state = _b[0], count = _b[1];
            return (React.createElement("span", { key: JSON.stringify(group.labels) + "-notifications-" + index, className: textStyles[state] },
                index > 0 && ', ', count + " " + state));
        })));
};
//# sourceMappingURL=AlertGroupHeader.js.map