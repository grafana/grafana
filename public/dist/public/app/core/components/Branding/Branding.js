import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useTheme2, styleMixins } from '@grafana/ui';
import { colorManipulator } from '@grafana/data';
var LoginLogo = function (_a) {
    var className = _a.className;
    return React.createElement("img", { className: className, src: "public/img/grafana_icon.svg", alt: "Grafana" });
};
var LoginBackground = function (_a) {
    var className = _a.className, children = _a.children;
    var theme = useTheme2();
    var background = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    &:before {\n      content: '';\n      position: absolute;\n      left: 0;\n      right: 0;\n      bottom: 0;\n      top: 0;\n      background: url(public/img/g8_login_", ".svg);\n      background-position: top center;\n      background-size: auto;\n      background-repeat: no-repeat;\n\n      opacity: 0;\n      transition: opacity 3s ease-in-out;\n\n      @media ", " {\n        background-position: center;\n        background-size: cover;\n      }\n    }\n  "], ["\n    &:before {\n      content: '';\n      position: absolute;\n      left: 0;\n      right: 0;\n      bottom: 0;\n      top: 0;\n      background: url(public/img/g8_login_", ".svg);\n      background-position: top center;\n      background-size: auto;\n      background-repeat: no-repeat;\n\n      opacity: 0;\n      transition: opacity 3s ease-in-out;\n\n      @media ", " {\n        background-position: center;\n        background-size: cover;\n      }\n    }\n  "])), theme.isDark ? 'dark' : 'light', styleMixins.mediaUp(theme.v1.breakpoints.md));
    return React.createElement("div", { className: cx(background, className) }, children);
};
var MenuLogo = function (_a) {
    var className = _a.className;
    return React.createElement("img", { className: className, src: "public/img/grafana_icon.svg", alt: "Grafana" });
};
var LoginBoxBackground = function () {
    var theme = useTheme2();
    return css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    background: ", ";\n    background-size: cover;\n  "], ["\n    background: ", ";\n    background-size: cover;\n  "])), colorManipulator.alpha(theme.colors.background.primary, 0.7));
};
var Branding = /** @class */ (function () {
    function Branding() {
    }
    Branding.LoginLogo = LoginLogo;
    Branding.LoginBackground = LoginBackground;
    Branding.MenuLogo = MenuLogo;
    Branding.LoginBoxBackground = LoginBoxBackground;
    Branding.AppTitle = 'Grafana';
    Branding.LoginTitle = 'Welcome to Grafana';
    Branding.GetLoginSubTitle = function () {
        return null;
    };
    return Branding;
}());
export { Branding };
var templateObject_1, templateObject_2;
//# sourceMappingURL=Branding.js.map