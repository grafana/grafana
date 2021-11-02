import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getGridStyles } from './gridStyles';
export var AmRootRouteRead = function (_a) {
    var routes = _a.routes;
    var styles = useStyles2(getGridStyles);
    var receiver = routes.receiver || '-';
    var groupBy = routes.groupBy.join(', ') || '-';
    var groupWait = routes.groupWaitValue ? "" + routes.groupWaitValue + routes.groupWaitValueType : '-';
    var groupInterval = routes.groupIntervalValue
        ? "" + routes.groupIntervalValue + routes.groupIntervalValueType
        : '-';
    var repeatInterval = routes.repeatIntervalValue
        ? "" + routes.repeatIntervalValue + routes.repeatIntervalValueType
        : '-';
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.titleCell }, "Contact point"),
        React.createElement("div", { className: styles.valueCell, "data-testid": "am-routes-root-receiver" }, receiver),
        React.createElement("div", { className: styles.titleCell }, "Group by"),
        React.createElement("div", { className: styles.valueCell, "data-testid": "am-routes-root-group-by" }, groupBy),
        React.createElement("div", { className: styles.titleCell }, "Timings"),
        React.createElement("div", { className: styles.valueCell, "data-testid": "am-routes-root-timings" },
            "Group wait: ",
            groupWait,
            " | Group interval: ",
            groupInterval,
            " | Repeat interval: ",
            repeatInterval)));
};
//# sourceMappingURL=AmRootRouteRead.js.map