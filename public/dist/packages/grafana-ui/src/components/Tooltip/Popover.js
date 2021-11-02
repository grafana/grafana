import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Manager, Popper as ReactPopper } from 'react-popper';
import { Portal } from '../Portal/Portal';
import Transition from 'react-transition-group/Transition';
var defaultTransitionStyles = {
    transitionProperty: 'opacity',
    transitionDuration: '200ms',
    transitionTimingFunction: 'linear',
    opacity: 0,
};
var transitionStyles = {
    exited: { opacity: 0 },
    entering: { opacity: 0 },
    entered: { opacity: 1, transitionDelay: '0s' },
    exiting: { opacity: 0, transitionDelay: '500ms' },
};
var Popover = /** @class */ (function (_super) {
    __extends(Popover, _super);
    function Popover() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Popover.prototype.render = function () {
        var _a = this.props, content = _a.content, show = _a.show, placement = _a.placement, onMouseEnter = _a.onMouseEnter, onMouseLeave = _a.onMouseLeave, className = _a.className, wrapperClassName = _a.wrapperClassName, renderArrow = _a.renderArrow, referenceElement = _a.referenceElement;
        return (React.createElement(Manager, null,
            React.createElement(Transition, { in: show, timeout: 100, mountOnEnter: true, unmountOnExit: true }, function (transitionState) {
                return (React.createElement(Portal, null,
                    React.createElement(ReactPopper, { placement: placement, referenceElement: referenceElement, modifiers: [
                            { name: 'preventOverflow', enabled: true, options: { rootBoundary: 'viewport' } },
                            {
                                name: 'eventListeners',
                                options: { scroll: true, resize: true },
                            },
                        ] }, function (_a) {
                        var ref = _a.ref, style = _a.style, placement = _a.placement, arrowProps = _a.arrowProps, update = _a.update;
                        return (React.createElement("div", { onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, ref: ref, style: __assign(__assign(__assign({}, style), defaultTransitionStyles), transitionStyles[transitionState]), "data-placement": placement, className: "" + wrapperClassName },
                            React.createElement("div", { className: className },
                                typeof content === 'string' && content,
                                React.isValidElement(content) && React.cloneElement(content),
                                typeof content === 'function' &&
                                    content({
                                        updatePopperPosition: update,
                                    }),
                                renderArrow &&
                                    renderArrow({
                                        arrowProps: arrowProps,
                                        placement: placement,
                                    }))));
                    })));
            })));
    };
    return Popover;
}(PureComponent));
export { Popover };
//# sourceMappingURL=Popover.js.map