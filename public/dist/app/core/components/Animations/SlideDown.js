import * as tslib_1 from "tslib";
import React from 'react';
import Transition from 'react-transition-group/Transition';
// When animating using max-height we need to use a static value.
// If this is not enough, pass in <SlideDown maxHeight="....
var defaultMaxHeight = '200px';
var defaultDuration = 200;
export var defaultStyle = {
    transition: "max-height " + defaultDuration + "ms ease-in-out",
    overflow: 'hidden',
};
export default (function (_a) {
    var children = _a.children, inProp = _a.in, _b = _a.maxHeight, maxHeight = _b === void 0 ? defaultMaxHeight : _b, _c = _a.style, style = _c === void 0 ? defaultStyle : _c;
    // There are 4 main states a Transition can be in:
    // ENTERING, ENTERED, EXITING, EXITED
    // https://reactcommunity.org/react-transition-group/
    var transitionStyles = {
        exited: { maxHeight: 0 },
        entering: { maxHeight: maxHeight },
        entered: { maxHeight: 'unset', overflow: 'visible' },
        exiting: { maxHeight: 0 },
    };
    return (React.createElement(Transition, { in: inProp, timeout: defaultDuration }, function (state) { return (React.createElement("div", { style: tslib_1.__assign({}, style, transitionStyles[state]) }, children)); }));
});
//# sourceMappingURL=SlideDown.js.map