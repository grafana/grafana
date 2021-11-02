import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { stylesFactory, useTheme } from '@grafana/ui';
import { TutorialCard } from './TutorialCard';
import { DocsCard } from './DocsCard';
export var Step = function (_a) {
    var step = _a.step;
    var theme = useTheme();
    var styles = getStyles(theme);
    return (React.createElement("div", { className: styles.setup },
        React.createElement("div", { className: styles.info },
            React.createElement("h2", { className: styles.title }, step.title),
            React.createElement("p", null, step.info)),
        React.createElement("div", { className: styles.cards }, step.cards.map(function (card, index) {
            var key = card.title + "-" + index;
            if (card.type === 'tutorial') {
                return React.createElement(TutorialCard, { key: key, card: card });
            }
            return React.createElement(DocsCard, { key: key, card: card });
        }))));
};
var getStyles = stylesFactory(function (theme) {
    return {
        setup: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      width: 95%;\n    "], ["\n      display: flex;\n      width: 95%;\n    "]))),
        info: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: 172px;\n      margin-right: 5%;\n\n      @media only screen and (max-width: ", ") {\n        margin-right: ", ";\n      }\n      @media only screen and (max-width: ", ") {\n        display: none;\n      }\n    "], ["\n      width: 172px;\n      margin-right: 5%;\n\n      @media only screen and (max-width: ", ") {\n        margin-right: ", ";\n      }\n      @media only screen and (max-width: ", ") {\n        display: none;\n      }\n    "])), theme.breakpoints.xxl, theme.spacing.xl, theme.breakpoints.sm),
        title: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.palette.blue95),
        cards: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      overflow-x: scroll;\n      overflow-y: hidden;\n      width: 100%;\n      display: flex;\n      justify-content: center;\n\n      @media only screen and (max-width: ", ") {\n        justify-content: flex-start;\n      }\n    "], ["\n      overflow-x: scroll;\n      overflow-y: hidden;\n      width: 100%;\n      display: flex;\n      justify-content: center;\n\n      @media only screen and (max-width: ", ") {\n        justify-content: flex-start;\n      }\n    "])), theme.breakpoints.xxl),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=Step.js.map