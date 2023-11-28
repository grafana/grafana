import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React from 'react';
import { renderMarkdown } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
export const OperationRowHelp = React.memo(React.forwardRef((_a, ref) => {
    var { className, children, markdown, onRemove } = _a, otherProps = __rest(_a, ["className", "children", "markdown", "onRemove"]);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", Object.assign({ className: cx(styles.wrapper, className) }, otherProps, { ref: ref }),
        markdown && markdownHelper(markdown),
        children));
}));
function markdownHelper(markdown) {
    const helpHtml = renderMarkdown(markdown);
    return React.createElement("div", { className: "markdown-html", dangerouslySetInnerHTML: { __html: helpHtml } });
}
OperationRowHelp.displayName = 'OperationRowHelp';
const getStyles = (theme) => {
    const borderRadius = theme.shape.radius.default;
    return {
        wrapper: css `
      padding: ${theme.spacing(2)};
      border: 2px solid ${theme.colors.background.secondary};
      border-top: none;
      border-radius: 0 0 ${borderRadius} ${borderRadius};
      position: relative;
      top: -4px;
    `,
    };
};
//# sourceMappingURL=OperationRowHelp.js.map