import { __makeTemplateObject } from "tslib";
import React from 'react';
import { LinkButton, VerticalGroup } from '@grafana/ui';
import { css } from '@emotion/css';
import { getConfig } from 'app/core/config';
export var UserSignup = function () {
    var href = getConfig().verifyEmailEnabled ? getConfig().appSubUrl + "/verify" : getConfig().appSubUrl + "/signup";
    var paddingTop = css({ paddingTop: '16px' });
    return (React.createElement(VerticalGroup, null,
        React.createElement("div", { className: paddingTop }, "New to Grafana?"),
        React.createElement(LinkButton, { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          width: 100%;\n          justify-content: center;\n        "], ["\n          width: 100%;\n          justify-content: center;\n        "]))), href: href, variant: "secondary", fill: "outline" }, "Sign up")));
};
var templateObject_1;
//# sourceMappingURL=UserSignup.js.map