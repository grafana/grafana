import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { stylesFactory, useTheme } from '../../themes';
var Orientation;
(function (Orientation) {
    Orientation[Orientation["Horizontal"] = 0] = "Horizontal";
    Orientation[Orientation["Vertical"] = 1] = "Vertical";
})(Orientation || (Orientation = {}));
export var Layout = function (_a) {
    var children = _a.children, _b = _a.orientation, orientation = _b === void 0 ? Orientation.Horizontal : _b, _c = _a.spacing, spacing = _c === void 0 ? 'sm' : _c, _d = _a.justify, justify = _d === void 0 ? 'flex-start' : _d, _e = _a.align, align = _e === void 0 ? 'normal' : _e, _f = _a.wrap, wrap = _f === void 0 ? false : _f, _g = _a.width, width = _g === void 0 ? '100%' : _g, _h = _a.height, height = _h === void 0 ? '100%' : _h, rest = __rest(_a, ["children", "orientation", "spacing", "justify", "align", "wrap", "width", "height"]);
    var theme = useTheme();
    var styles = getStyles(theme, orientation, spacing, justify, align, wrap);
    return (React.createElement("div", __assign({ className: styles.layout, style: { width: width, height: height } }, rest), React.Children.toArray(children)
        .filter(Boolean)
        .map(function (child, index) {
        return (React.createElement("div", { className: styles.childWrapper, key: index }, child));
    })));
};
export var HorizontalGroup = function (_a) {
    var children = _a.children, spacing = _a.spacing, justify = _a.justify, _b = _a.align, align = _b === void 0 ? 'center' : _b, wrap = _a.wrap, width = _a.width, height = _a.height;
    return (React.createElement(Layout, { spacing: spacing, justify: justify, orientation: Orientation.Horizontal, align: align, width: width, height: height, wrap: wrap }, children));
};
export var VerticalGroup = function (_a) {
    var children = _a.children, spacing = _a.spacing, justify = _a.justify, align = _a.align, width = _a.width, height = _a.height;
    return (React.createElement(Layout, { spacing: spacing, justify: justify, orientation: Orientation.Vertical, align: align, width: width, height: height }, children));
};
export var Container = function (_a) {
    var children = _a.children, padding = _a.padding, margin = _a.margin, grow = _a.grow, shrink = _a.shrink;
    var theme = useTheme();
    var styles = getContainerStyles(theme, padding, margin);
    return (React.createElement("div", { className: cx(styles.wrapper, grow !== undefined && css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            flex-grow: ", ";\n          "], ["\n            flex-grow: ", ";\n          "])), grow), shrink !== undefined && css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n            flex-shrink: ", ";\n          "], ["\n            flex-shrink: ", ";\n          "])), shrink)) }, children));
};
var getStyles = stylesFactory(function (theme, orientation, spacing, justify, align, wrap) {
    var finalSpacing = spacing !== 'none' ? theme.spacing[spacing] : 0;
    // compensate for last row margin when wrapped, horizontal layout
    var marginCompensation = (orientation === Orientation.Horizontal && !wrap) || orientation === Orientation.Vertical
        ? 0
        : "-" + finalSpacing;
    var label = orientation === Orientation.Vertical ? 'vertical-group' : 'horizontal-group';
    return {
        layout: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        label: ", ";\n        display: flex;\n        flex-direction: ", ";\n        flex-wrap: ", ";\n        justify-content: ", ";\n        align-items: ", ";\n        height: 100%;\n        max-width: 100%;\n        // compensate for last row margin when wrapped, horizontal layout\n        margin-bottom: ", ";\n      "], ["\n        label: ", ";\n        display: flex;\n        flex-direction: ", ";\n        flex-wrap: ", ";\n        justify-content: ", ";\n        align-items: ", ";\n        height: 100%;\n        max-width: 100%;\n        // compensate for last row margin when wrapped, horizontal layout\n        margin-bottom: ", ";\n      "])), label, orientation === Orientation.Vertical ? 'column' : 'row', wrap ? 'wrap' : 'nowrap', justify, align, marginCompensation),
        childWrapper: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        label: layoutChildrenWrapper;\n        margin-bottom: ", ";\n        margin-right: ", ";\n        display: flex;\n        align-items: ", ";\n\n        &:last-child {\n          margin-bottom: ", ";\n          margin-right: ", ";\n        }\n      "], ["\n        label: layoutChildrenWrapper;\n        margin-bottom: ", ";\n        margin-right: ", ";\n        display: flex;\n        align-items: ", ";\n\n        &:last-child {\n          margin-bottom: ", ";\n          margin-right: ", ";\n        }\n      "])), orientation === Orientation.Horizontal && !wrap ? 0 : finalSpacing, orientation === Orientation.Horizontal ? finalSpacing : 0, align, orientation === Orientation.Vertical && 0, orientation === Orientation.Horizontal && 0),
    };
});
var getContainerStyles = stylesFactory(function (theme, padding, margin) {
    var paddingSize = (padding && padding !== 'none' && theme.spacing[padding]) || 0;
    var marginSize = (margin && margin !== 'none' && theme.spacing[margin]) || 0;
    return {
        wrapper: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      label: container;\n      margin: ", ";\n      padding: ", ";\n    "], ["\n      label: container;\n      margin: ", ";\n      padding: ", ";\n    "])), marginSize, paddingSize),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=Layout.js.map