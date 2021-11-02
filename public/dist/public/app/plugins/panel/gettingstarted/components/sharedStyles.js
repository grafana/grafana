import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { stylesFactory } from '@grafana/ui';
export var cardStyle = stylesFactory(function (theme, complete) {
    var completeGradient = 'linear-gradient(to right, #5182CC 0%, #245BAF 100%)';
    var darkThemeGradients = complete ? completeGradient : 'linear-gradient(to right, #f05a28 0%, #fbca0a 100%)';
    var lightThemeGradients = complete ? completeGradient : 'linear-gradient(to right, #FBCA0A 0%, #F05A28 100%)';
    var borderGradient = theme.isDark ? darkThemeGradients : lightThemeGradients;
    return "\n      background-color: " + theme.colors.bg2 + ";\n      margin-right: " + theme.spacing.xl + ";\n      border: 1px solid " + theme.colors.border1 + ";\n      border-bottom-left-radius: " + theme.border.radius.md + ";\n      border-bottom-right-radius: " + theme.border.radius.md + ";\n      position: relative;\n      max-height: 230px;\n\n      @media only screen and (max-width: " + theme.breakpoints.xxl + ") {\n        margin-right: " + theme.spacing.md + ";\n      }\n      &::before {\n        display: block;\n        content: ' ';\n        position: absolute;\n        left: 0;\n        right: 0;\n        height: 2px;\n        top: 0;\n        background-image: " + borderGradient + ";\n      }\n";
});
export var iconStyle = stylesFactory(function (theme, complete) { return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n\n    @media only screen and (max-width: ", ") {\n      display: none;\n    }\n  "], ["\n    color: ", ";\n\n    @media only screen and (max-width: ", ") {\n      display: none;\n    }\n  "])), complete ? theme.palette.blue95 : theme.colors.textWeak, theme.breakpoints.sm); });
export var cardContent = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n  padding: 16px;\n"], ["\n  padding: 16px;\n"])));
var templateObject_1, templateObject_2;
//# sourceMappingURL=sharedStyles.js.map