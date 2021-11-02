import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { forwardRef } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
export var ToolbarButtonRow = forwardRef(function (_a, ref) {
    var className = _a.className, children = _a.children, rest = __rest(_a, ["className", "children"]);
    var styles = useStyles2(getStyles);
    return (React.createElement("div", __assign({ ref: ref, className: cx(styles.wrapper, className) }, rest), children));
});
ToolbarButtonRow.displayName = 'ToolbarButtonRow';
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n\n    > .button-group,\n    > .toolbar-button {\n      margin-left: ", ";\n\n      &:first-child {\n        margin-left: 0;\n      }\n    }\n  "], ["\n    display: flex;\n\n    > .button-group,\n    > .toolbar-button {\n      margin-left: ", ";\n\n      &:first-child {\n        margin-left: 0;\n      }\n    }\n  "])), theme.spacing(1)),
}); };
var templateObject_1;
//# sourceMappingURL=ToolbarButtonRow.js.map