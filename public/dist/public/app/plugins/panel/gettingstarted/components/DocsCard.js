import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Icon, stylesFactory, useTheme } from '@grafana/ui';
import { css } from '@emotion/css';
import { cardContent, cardStyle, iconStyle } from './sharedStyles';
export var DocsCard = function (_a) {
    var card = _a.card;
    var theme = useTheme();
    var styles = getStyles(theme, card.done);
    return (React.createElement("div", { className: styles.card },
        React.createElement("div", { className: cardContent },
            React.createElement("a", { href: card.href + "?utm_source=grafana_gettingstarted", className: styles.url },
                React.createElement("div", { className: styles.heading }, card.done ? 'complete' : card.heading),
                React.createElement("h4", { className: styles.title }, card.title),
                React.createElement("div", null,
                    React.createElement(Icon, { className: iconStyle(theme, card.done), name: card.icon, size: "xxl" })))),
        React.createElement("a", { href: card.learnHref + "?utm_source=grafana_gettingstarted", className: styles.learnUrl, target: "_blank", rel: "noreferrer" },
            "Learn how in the docs ",
            React.createElement(Icon, { name: "external-link-alt" }))));
};
var getStyles = stylesFactory(function (theme, complete) {
    return {
        card: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      ", "\n\n      min-width: 230px;\n\n      @media only screen and (max-width: ", ") {\n        min-width: 192px;\n      }\n    "], ["\n      ", "\n\n      min-width: 230px;\n\n      @media only screen and (max-width: ", ") {\n        min-width: 192px;\n      }\n    "])), cardStyle(theme, complete), theme.breakpoints.md),
        heading: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      text-transform: uppercase;\n      color: ", ";\n      margin-bottom: ", ";\n    "], ["\n      text-transform: uppercase;\n      color: ", ";\n      margin-bottom: ", ";\n    "])), complete ? theme.palette.blue95 : '#FFB357', theme.spacing.md),
        title: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.md),
        url: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: inline-block;\n    "], ["\n      display: inline-block;\n    "]))),
        learnUrl: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      border-top: 1px solid ", ";\n      position: absolute;\n      bottom: 0;\n      padding: 8px 16px;\n      width: 100%;\n    "], ["\n      border-top: 1px solid ", ";\n      position: absolute;\n      bottom: 0;\n      padding: 8px 16px;\n      width: 100%;\n    "])), theme.colors.border1),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=DocsCard.js.map