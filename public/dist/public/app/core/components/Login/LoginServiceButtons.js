import { __makeTemplateObject, __read } from "tslib";
import React from 'react';
import config from 'app/core/config';
import { css, cx } from '@emotion/css';
import { Icon, LinkButton, useStyles, useTheme2, VerticalGroup } from '@grafana/ui';
import { DEFAULT_SAML_NAME } from '@grafana/data';
import { pickBy } from 'lodash';
var loginServices = function () {
    var oauthEnabled = !!config.oauth;
    return {
        saml: {
            bgColor: '#464646',
            enabled: config.samlEnabled,
            name: config.samlName || DEFAULT_SAML_NAME,
            icon: 'key-skeleton-alt',
        },
        google: {
            bgColor: '#e84d3c',
            enabled: oauthEnabled && config.oauth.google,
            name: 'Google',
            icon: 'google',
        },
        azuread: {
            bgColor: '#2f2f2f',
            enabled: oauthEnabled && config.oauth.azuread,
            name: 'Microsoft',
            icon: 'microsoft',
        },
        github: {
            bgColor: '#464646',
            enabled: oauthEnabled && config.oauth.github,
            name: 'GitHub',
            icon: 'github',
        },
        gitlab: {
            bgColor: '#fc6d26',
            enabled: oauthEnabled && config.oauth.gitlab,
            name: 'GitLab',
            icon: 'gitlab',
        },
        grafanacom: {
            bgColor: '#262628',
            enabled: oauthEnabled && config.oauth.grafana_com,
            name: 'Grafana.com',
            hrefName: 'grafana_com',
            icon: 'grafana',
        },
        okta: {
            bgColor: '#2f2f2f',
            enabled: oauthEnabled && config.oauth.okta,
            name: 'Okta',
            icon: 'okta',
        },
        oauth: {
            bgColor: '#262628',
            enabled: oauthEnabled && config.oauth.generic_oauth,
            name: oauthEnabled && config.oauth.generic_oauth ? config.oauth.generic_oauth.name : 'OAuth',
            icon: 'signin',
            hrefName: 'generic_oauth',
        },
    };
};
var getServiceStyles = function (theme) {
    return {
        button: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      color: #d8d9da;\n      position: relative;\n    "], ["\n      color: #d8d9da;\n      position: relative;\n    "]))),
        buttonIcon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      position: absolute;\n      left: ", ";\n      top: 50%;\n      transform: translateY(-50%);\n    "], ["\n      position: absolute;\n      left: ", ";\n      top: 50%;\n      transform: translateY(-50%);\n    "])), theme.spacing.sm),
        divider: {
            base: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        color: ", ";\n        display: flex;\n        margin-bottom: ", ";\n        justify-content: space-between;\n        text-align: center;\n        width: 100%;\n      "], ["\n        color: ", ";\n        display: flex;\n        margin-bottom: ", ";\n        justify-content: space-between;\n        text-align: center;\n        width: 100%;\n      "])), theme.colors.text, theme.spacing.sm),
            line: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        width: 100px;\n        height: 10px;\n        border-bottom: 1px solid ", ";\n      "], ["\n        width: 100px;\n        height: 10px;\n        border-bottom: 1px solid ", ";\n      "])), theme.colors.text),
        },
    };
};
var LoginDivider = function () {
    var styles = useStyles(getServiceStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.divider.base },
            React.createElement("div", null,
                React.createElement("div", { className: styles.divider.line })),
            React.createElement("div", null,
                React.createElement("span", null, !config.disableLoginForm && React.createElement("span", null, "or"))),
            React.createElement("div", null,
                React.createElement("div", { className: styles.divider.line }))),
        React.createElement("div", { className: "clearfix" })));
};
function getButtonStyleFor(service, styles, theme) {
    return cx(styles.button, css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      background-color: ", ";\n      color: ", ";\n\n      &:hover {\n        background-color: ", ";\n        box-shadow: ", ";\n      }\n    "], ["\n      background-color: ", ";\n      color: ", ";\n\n      &:hover {\n        background-color: ", ";\n        box-shadow: ", ";\n      }\n    "])), service.bgColor, theme.colors.getContrastText(service.bgColor), theme.colors.emphasize(service.bgColor, 0.15), theme.shadows.z1));
}
export var LoginServiceButtons = function () {
    var enabledServices = pickBy(loginServices(), function (service) { return service.enabled; });
    var hasServices = Object.keys(enabledServices).length > 0;
    var theme = useTheme2();
    var styles = useStyles(getServiceStyles);
    if (hasServices) {
        return (React.createElement(VerticalGroup, null,
            React.createElement(LoginDivider, null),
            Object.entries(enabledServices).map(function (_a) {
                var _b = __read(_a, 2), key = _b[0], service = _b[1];
                return (React.createElement(LinkButton, { key: key, className: getButtonStyleFor(service, styles, theme), href: "login/" + (service.hrefName ? service.hrefName : key), target: "_self", fullWidth: true },
                    React.createElement(Icon, { className: styles.buttonIcon, name: service.icon }),
                    "Sign in with ",
                    service.name));
            })));
    }
    return null;
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=LoginServiceButtons.js.map