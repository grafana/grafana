import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { cx, css } from '@emotion/css';
import { useTheme } from '../../themes';
/** @beta */
export var InlineSegmentGroup = function (_a) {
    var children = _a.children, className = _a.className, grow = _a.grow, htmlProps = __rest(_a, ["children", "className", "grow"]);
    var theme = useTheme();
    var styles = getStyles(theme, grow);
    return (React.createElement("div", __assign({ className: cx(styles.container, className) }, htmlProps), children));
};
InlineSegmentGroup.displayName = 'InlineSegmentGroup';
var getStyles = function (theme, grow) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      align-items: flex-start;\n      text-align: left;\n      position: relative;\n      flex: ", " 0 auto;\n      margin-bottom: ", ";\n    "], ["\n      display: flex;\n      flex-direction: row;\n      align-items: flex-start;\n      text-align: left;\n      position: relative;\n      flex: ", " 0 auto;\n      margin-bottom: ", ";\n    "])), grow ? 1 : 0, theme.spacing.xs),
    };
};
var templateObject_1;
//# sourceMappingURL=InlineSegmentGroup.js.map