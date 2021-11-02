import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { renderMarkdown } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
export var OperationRowHelp = React.memo(React.forwardRef(function (_a, ref) {
    var className = _a.className, children = _a.children, markdown = _a.markdown, onRemove = _a.onRemove, otherProps = __rest(_a, ["className", "children", "markdown", "onRemove"]);
    var styles = useStyles2(getStyles);
    return (React.createElement("div", __assign({ className: cx(styles.wrapper, className) }, otherProps, { ref: ref }),
        markdown && markdownHelper(markdown),
        children));
}));
function markdownHelper(markdown) {
    var helpHtml = renderMarkdown(markdown);
    return React.createElement("div", { className: "markdown-html", dangerouslySetInnerHTML: { __html: helpHtml } });
}
OperationRowHelp.displayName = 'OperationRowHelp';
var getStyles = function (theme) {
    var borderRadius = theme.shape.borderRadius();
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: ", ";\n      border: 2px solid ", ";\n      border-top: none;\n      border-radius: 0 0 ", " ", ";\n      position: relative;\n      top: -4px;\n    "], ["\n      padding: ", ";\n      border: 2px solid ", ";\n      border-top: none;\n      border-radius: 0 0 ", " ", ";\n      position: relative;\n      top: -4px;\n    "])), theme.spacing(2), theme.colors.background.secondary, borderRadius, borderRadius),
    };
};
var templateObject_1;
//# sourceMappingURL=OperationRowHelp.js.map