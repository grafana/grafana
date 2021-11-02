import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles } from '../../themes';
export var InlineFieldRow = function (_a) {
    var children = _a.children, className = _a.className, htmlProps = __rest(_a, ["children", "className"]);
    var styles = useStyles(getStyles);
    return (React.createElement("div", __assign({ className: cx(styles.container, className) }, htmlProps), children));
};
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: InlineFieldRow;\n      display: flex;\n      flex-direction: row;\n      flex-wrap: wrap;\n      align-content: flex-start;\n      row-gap: ", ";\n    "], ["\n      label: InlineFieldRow;\n      display: flex;\n      flex-direction: row;\n      flex-wrap: wrap;\n      align-content: flex-start;\n      row-gap: ", ";\n    "])), theme.spacing.xs),
    };
};
var templateObject_1;
//# sourceMappingURL=InlineFieldRow.js.map