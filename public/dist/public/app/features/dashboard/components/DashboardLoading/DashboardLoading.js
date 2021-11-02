import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from 'emotion';
import { Button, HorizontalGroup, Spinner, useStyles, VerticalGroup } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
export var DashboardLoading = function (_a) {
    var initPhase = _a.initPhase;
    var styles = useStyles(getStyles);
    var cancelVariables = function () {
        locationService.push('/');
    };
    return (React.createElement("div", { className: styles.dashboardLoading },
        React.createElement("div", { className: styles.dashboardLoadingText },
            React.createElement(VerticalGroup, { spacing: "md" },
                React.createElement(HorizontalGroup, { align: "center", justify: "center", spacing: "xs" },
                    React.createElement(Spinner, { inline: true }),
                    " ",
                    initPhase),
                ' ',
                React.createElement(HorizontalGroup, { align: "center", justify: "center" },
                    React.createElement(Button, { variant: "secondary", size: "md", icon: "repeat", onClick: cancelVariables }, "Cancel loading dashboard"))))));
};
export var getStyles = function (theme) {
    return {
        dashboardLoading: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      height: 60vh;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "], ["\n      height: 60vh;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "]))),
        dashboardLoadingText: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      font-size: ", ";\n    "], ["\n      font-size: ", ";\n    "])), theme.typography.size.lg),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=DashboardLoading.js.map