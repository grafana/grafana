import { __assign, __rest } from "tslib";
import React, { createRef } from 'react';
import { Popover } from './Popover';
import { PopoverController } from './PopoverController';
export var Tooltip = React.memo(function (_a) {
    var children = _a.children, theme = _a.theme, controllerProps = __rest(_a, ["children", "theme"]);
    var tooltipTriggerRef = createRef();
    var popperBackgroundClassName = 'popper__background' + (theme ? ' popper__background--' + theme : '');
    return (React.createElement(PopoverController, __assign({}, controllerProps), function (showPopper, hidePopper, popperProps) {
        {
            /* Override internal 'show' state if passed in as prop */
        }
        var payloadProps = __assign(__assign({}, popperProps), { show: controllerProps.show !== undefined ? controllerProps.show : popperProps.show });
        return (React.createElement(React.Fragment, null,
            tooltipTriggerRef.current && controllerProps.content && (React.createElement(Popover, __assign({}, payloadProps, { onMouseEnter: showPopper, onMouseLeave: hidePopper, referenceElement: tooltipTriggerRef.current, wrapperClassName: "popper", className: popperBackgroundClassName, renderArrow: function (_a) {
                    var arrowProps = _a.arrowProps, placement = _a.placement;
                    return (React.createElement("div", __assign({ className: "popper__arrow", "data-placement": placement }, arrowProps)));
                } }))),
            React.cloneElement(children, {
                ref: tooltipTriggerRef,
                onMouseEnter: showPopper,
                onMouseLeave: hidePopper,
            })));
    }));
});
Tooltip.displayName = 'Tooltip';
//# sourceMappingURL=Tooltip.js.map