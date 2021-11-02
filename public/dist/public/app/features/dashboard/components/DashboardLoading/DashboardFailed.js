import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from 'emotion';
import { Alert, useStyles } from '@grafana/ui';
import { AppNotificationSeverity } from 'app/types';
import { getMessageFromError } from 'app/core/utils/errors';
export var DashboardFailed = function (_a) {
    var initError = _a.initError;
    var styles = useStyles(getStyles);
    if (!initError) {
        return null;
    }
    return (React.createElement("div", { className: styles.dashboardLoading },
        React.createElement(Alert, { severity: AppNotificationSeverity.Error, title: initError.message }, getMessageFromError(initError.error))));
};
export var getStyles = function (theme) {
    return {
        dashboardLoading: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      height: 60vh;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "], ["\n      height: 60vh;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=DashboardFailed.js.map