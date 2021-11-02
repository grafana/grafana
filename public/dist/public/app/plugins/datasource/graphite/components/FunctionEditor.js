import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { useRef } from 'react';
import { PopoverController, Popover, ClickOutsideWrapper, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { FunctionEditorControls } from './FunctionEditorControls';
import { css } from '@emotion/css';
var getStyles = function (theme) {
    return {
        icon: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing(0.5)),
        label: css({
            fontWeight: theme.typography.fontWeightMedium,
            fontSize: theme.typography.bodySmall.fontSize,
            cursor: 'pointer',
            display: 'inline-block',
            paddingBottom: '2px',
        }),
    };
};
var FunctionEditor = function (_a) {
    var onMoveLeft = _a.onMoveLeft, onMoveRight = _a.onMoveRight, func = _a.func, props = __rest(_a, ["onMoveLeft", "onMoveRight", "func"]);
    var triggerRef = useRef(null);
    var styles = useStyles2(getStyles);
    var renderContent = function (_a) {
        var updatePopperPosition = _a.updatePopperPosition;
        return (React.createElement(FunctionEditorControls, __assign({}, props, { func: func, onMoveLeft: function () {
                onMoveLeft(func);
                updatePopperPosition();
            }, onMoveRight: function () {
                onMoveRight(func);
                updatePopperPosition();
            } })));
    };
    return (React.createElement(PopoverController, { content: renderContent, placement: "top", hideAfter: 100 }, function (showPopper, hidePopper, popperProps) {
        return (React.createElement(React.Fragment, null,
            triggerRef.current && (React.createElement(Popover, __assign({}, popperProps, { referenceElement: triggerRef.current, wrapperClassName: "popper", className: "popper__background", renderArrow: function (_a) {
                    var arrowProps = _a.arrowProps, placement = _a.placement;
                    return (React.createElement("div", __assign({ className: "popper__arrow", "data-placement": placement }, arrowProps)));
                } }))),
            React.createElement(ClickOutsideWrapper, { onClick: function () {
                    if (popperProps.show) {
                        hidePopper();
                    }
                } },
                React.createElement("span", { ref: triggerRef, onClick: popperProps.show ? hidePopper : showPopper, className: styles.label },
                    func.def.unknown && (React.createElement(Tooltip, { content: React.createElement(TooltipContent, null), placement: "bottom" },
                        React.createElement(Icon, { "data-testid": "warning-icon", name: "exclamation-triangle", size: "xs", className: styles.icon }))),
                    func.def.name))));
    }));
};
var TooltipContent = React.memo(function () {
    return (React.createElement("span", null,
        "This function is not supported. Check your function for typos and",
        ' ',
        React.createElement("a", { target: "_blank", className: "external-link", rel: "noreferrer noopener", href: "https://graphite.readthedocs.io/en/latest/functions.html" }, "read the docs"),
        ' ',
        "to see whether you need to upgrade your data source\u2019s version to make this function available."));
});
TooltipContent.displayName = 'FunctionEditorTooltipContent';
export { FunctionEditor };
var templateObject_1;
//# sourceMappingURL=FunctionEditor.js.map