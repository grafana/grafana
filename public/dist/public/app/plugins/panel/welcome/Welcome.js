import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { stylesFactory, useTheme } from '@grafana/ui';
var helpOptions = [
    { value: 0, label: 'Documentation', href: 'https://grafana.com/docs/grafana/latest' },
    { value: 1, label: 'Tutorials', href: 'https://grafana.com/tutorials' },
    { value: 2, label: 'Community', href: 'https://community.grafana.com' },
    { value: 3, label: 'Public Slack', href: 'http://slack.grafana.com' },
];
export var WelcomeBanner = function () {
    var styles = getStyles(useTheme());
    return (React.createElement("div", { className: styles.container },
        React.createElement("h1", { className: styles.title }, "Welcome to Grafana"),
        React.createElement("div", { className: styles.help },
            React.createElement("h3", { className: styles.helpText }, "Need help?"),
            React.createElement("div", { className: styles.helpLinks }, helpOptions.map(function (option, index) {
                return (React.createElement("a", { key: option.label + "-" + index, className: styles.helpLink, href: option.href + "?utm_source=grafana_gettingstarted" }, option.label));
            })))));
};
var getStyles = stylesFactory(function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      /// background: url(public/img/g8_home_v2.svg) no-repeat;\n      background-size: cover;\n      height: 100%;\n      align-items: center;\n      padding: 0 16px;\n      justify-content: space-between;\n      padding: 0 ", ";\n\n      @media only screen and (max-width: ", ") {\n        background-position: 0px;\n        flex-direction: column;\n        align-items: flex-start;\n        justify-content: center;\n      }\n\n      @media only screen and (max-width: ", ") {\n        padding: 0 ", ";\n      }\n    "], ["\n      display: flex;\n      /// background: url(public/img/g8_home_v2.svg) no-repeat;\n      background-size: cover;\n      height: 100%;\n      align-items: center;\n      padding: 0 16px;\n      justify-content: space-between;\n      padding: 0 ", ";\n\n      @media only screen and (max-width: ", ") {\n        background-position: 0px;\n        flex-direction: column;\n        align-items: flex-start;\n        justify-content: center;\n      }\n\n      @media only screen and (max-width: ", ") {\n        padding: 0 ", ";\n      }\n    "])), theme.spacing.lg, theme.breakpoints.lg, theme.breakpoints.sm, theme.spacing.sm),
        title: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-bottom: 0;\n\n      @media only screen and (max-width: ", ") {\n        margin-bottom: ", ";\n      }\n\n      @media only screen and (max-width: ", ") {\n        font-size: ", ";\n      }\n      @media only screen and (max-width: ", ") {\n        font-size: ", ";\n      }\n    "], ["\n      margin-bottom: 0;\n\n      @media only screen and (max-width: ", ") {\n        margin-bottom: ", ";\n      }\n\n      @media only screen and (max-width: ", ") {\n        font-size: ", ";\n      }\n      @media only screen and (max-width: ", ") {\n        font-size: ", ";\n      }\n    "])), theme.breakpoints.lg, theme.spacing.sm, theme.breakpoints.md, theme.typography.heading.h2, theme.breakpoints.sm, theme.typography.heading.h3),
        help: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      align-items: baseline;\n    "], ["\n      display: flex;\n      align-items: baseline;\n    "]))),
        helpText: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-right: ", ";\n      margin-bottom: 0;\n\n      @media only screen and (max-width: ", ") {\n        font-size: ", ";\n      }\n\n      @media only screen and (max-width: ", ") {\n        display: none;\n      }\n    "], ["\n      margin-right: ", ";\n      margin-bottom: 0;\n\n      @media only screen and (max-width: ", ") {\n        font-size: ", ";\n      }\n\n      @media only screen and (max-width: ", ") {\n        display: none;\n      }\n    "])), theme.spacing.md, theme.breakpoints.md, theme.typography.heading.h4, theme.breakpoints.sm),
        helpLinks: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      flex-wrap: wrap;\n    "], ["\n      display: flex;\n      flex-wrap: wrap;\n    "]))),
        helpLink: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      margin-right: ", ";\n      text-decoration: underline;\n      text-wrap: no-wrap;\n\n      @media only screen and (max-width: ", ") {\n        margin-right: 8px;\n      }\n    "], ["\n      margin-right: ", ";\n      text-decoration: underline;\n      text-wrap: no-wrap;\n\n      @media only screen and (max-width: ", ") {\n        margin-right: 8px;\n      }\n    "])), theme.spacing.md, theme.breakpoints.sm),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=Welcome.js.map