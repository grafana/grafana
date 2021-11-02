import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { forwardRef } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
export var ButtonGroup = forwardRef(function (_a, ref) {
    var className = _a.className, children = _a.children, rest = __rest(_a, ["className", "children"]);
    var styles = useStyles2(getStyles);
    return (React.createElement("div", __assign({ ref: ref, className: cx('button-group', styles.wrapper, className) }, rest), children));
});
ButtonGroup.displayName = 'ButtonGroup';
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n\n    > .button-group:not(:first-child) > button,\n    > button:not(:first-child) {\n      border-top-left-radius: 0;\n      border-bottom-left-radius: 0;\n    }\n\n    > .button-group:not(:last-child) > button,\n    > button:not(:last-child) {\n      border-top-right-radius: 0;\n      border-bottom-right-radius: 0;\n      border-right-width: 0;\n    }\n  "], ["\n    display: flex;\n\n    > .button-group:not(:first-child) > button,\n    > button:not(:first-child) {\n      border-top-left-radius: 0;\n      border-bottom-left-radius: 0;\n    }\n\n    > .button-group:not(:last-child) > button,\n    > button:not(:last-child) {\n      border-top-right-radius: 0;\n      border-bottom-right-radius: 0;\n      border-right-width: 0;\n    }\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=ButtonGroup.js.map