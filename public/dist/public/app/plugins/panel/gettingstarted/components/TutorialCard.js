import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Icon, stylesFactory, useTheme } from '@grafana/ui';
import { css } from '@emotion/css';
import store from 'app/core/store';
import { cardContent, cardStyle, iconStyle } from './sharedStyles';
export var TutorialCard = function (_a) {
    var card = _a.card;
    var theme = useTheme();
    var styles = getStyles(theme, card.done);
    return (React.createElement("a", { className: styles.card, onClick: function (event) { return handleTutorialClick(event, card); } },
        React.createElement("div", { className: cardContent },
            React.createElement("div", { className: styles.type }, card.type),
            React.createElement("div", { className: styles.heading }, card.done ? 'complete' : card.heading),
            React.createElement("h4", { className: styles.cardTitle }, card.title),
            React.createElement("div", { className: styles.info }, card.info),
            React.createElement(Icon, { className: iconStyle(theme, card.done), name: card.icon, size: "xxl" }))));
};
var handleTutorialClick = function (event, card) {
    event.preventDefault();
    var isSet = store.get(card.key);
    if (!isSet) {
        store.set(card.key, true);
    }
    window.open(card.href + "?utm_source=grafana_gettingstarted", '_blank');
};
var getStyles = stylesFactory(function (theme, complete) {
    return {
        card: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      ", "\n      width: 460px;\n      min-width: 460px;\n\n      @media only screen and (max-width: ", ") {\n        min-width: 368px;\n      }\n\n      @media only screen and (max-width: ", ") {\n        min-width: 272px;\n      }\n    "], ["\n      ", "\n      width: 460px;\n      min-width: 460px;\n\n      @media only screen and (max-width: ", ") {\n        min-width: 368px;\n      }\n\n      @media only screen and (max-width: ", ") {\n        min-width: 272px;\n      }\n    "])), cardStyle(theme, complete), theme.breakpoints.xl, theme.breakpoints.lg),
        type: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      text-transform: uppercase;\n    "], ["\n      color: ", ";\n      text-transform: uppercase;\n    "])), theme.colors.textBlue),
        heading: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      text-transform: uppercase;\n      color: ", ";\n      margin-bottom: ", ";\n    "], ["\n      text-transform: uppercase;\n      color: ", ";\n      margin-bottom: ", ";\n    "])), theme.colors.textBlue, theme.spacing.sm),
        cardTitle: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.md),
        info: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.md),
        status: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      display: flex;\n      justify-content: flex-end;\n    "], ["\n      display: flex;\n      justify-content: flex-end;\n    "]))),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=TutorialCard.js.map