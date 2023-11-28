import { __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { FunctionEditorControls } from './FunctionEditorControls';
const getStyles = (theme) => {
    return {
        icon: css `
      margin-right: ${theme.spacing(0.5)};
    `,
        label: css({
            fontWeight: theme.typography.fontWeightMedium,
            fontSize: theme.typography.bodySmall.fontSize,
            cursor: 'pointer',
            display: 'inline-block',
        }),
    };
};
const FunctionEditor = (_a) => {
    var { onMoveLeft, onMoveRight, func } = _a, props = __rest(_a, ["onMoveLeft", "onMoveRight", "func"]);
    const styles = useStyles2(getStyles);
    const renderContent = ({ updatePopperPosition }) => (React.createElement(FunctionEditorControls, Object.assign({}, props, { func: func, onMoveLeft: () => {
            onMoveLeft(func);
            updatePopperPosition();
        }, onMoveRight: () => {
            onMoveRight(func);
            updatePopperPosition();
        } })));
    return (React.createElement(React.Fragment, null,
        func.def.unknown && (React.createElement(Tooltip, { content: React.createElement(TooltipContent, null), placement: "bottom", interactive: true },
            React.createElement(Icon, { "data-testid": "warning-icon", name: "exclamation-triangle", size: "xs", className: styles.icon }))),
        React.createElement(Tooltip, { content: renderContent, placement: "top", interactive: true },
            React.createElement("span", { className: styles.label }, func.def.name))));
};
const TooltipContent = React.memo(() => {
    return (React.createElement("span", null,
        "This function is not supported. Check your function for typos and",
        ' ',
        React.createElement("a", { target: "_blank", className: "external-link", rel: "noreferrer noopener", href: "https://graphite.readthedocs.io/en/latest/functions.html" }, "read the docs"),
        ' ',
        "to see whether you need to upgrade your data source\u2019s version to make this function available."));
});
TooltipContent.displayName = 'FunctionEditorTooltipContent';
export { FunctionEditor };
//# sourceMappingURL=FunctionEditor.js.map