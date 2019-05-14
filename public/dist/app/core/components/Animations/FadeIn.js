import * as tslib_1 from "tslib";
import React from 'react';
import Transition from 'react-transition-group/Transition';
export var FadeIn = function (props) {
    var defaultStyle = {
        transition: "opacity " + props.duration + "ms linear",
        opacity: 0,
    };
    var transitionStyles = {
        exited: { opacity: 0, display: 'none' },
        entering: { opacity: 0 },
        entered: { opacity: 1 },
        exiting: { opacity: 0 },
    };
    return (React.createElement(Transition, { in: props.in, timeout: props.duration, unmountOnExit: props.unmountOnExit || false, onExited: props.onExited }, function (state) { return (React.createElement("div", { style: tslib_1.__assign({}, defaultStyle, transitionStyles[state]) }, props.children)); }));
};
//# sourceMappingURL=FadeIn.js.map