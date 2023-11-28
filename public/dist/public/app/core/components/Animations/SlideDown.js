import React from 'react';
import Transition from 'react-transition-group/Transition';
// When animating using max-height we need to use a static value.
// If this is not enough, pass in <SlideDown maxHeight="....
const defaultMaxHeight = '200px';
const defaultDuration = 200;
export const defaultStyle = {
    transition: `max-height ${defaultDuration}ms ease-in-out`,
    overflow: 'hidden',
};
export const SlideDown = ({ children, in: inProp, maxHeight = defaultMaxHeight, style = defaultStyle }) => {
    // There are 4 main states a Transition can be in:
    // ENTERING, ENTERED, EXITING, EXITED
    // https://reactcommunity.or[g/react-transition-group/
    const transitionStyles = {
        exited: { maxHeight: 0 },
        entering: { maxHeight: maxHeight },
        entered: { maxHeight: 'unset', overflow: 'visible' },
        exiting: { maxHeight: 0 },
    };
    return (React.createElement(Transition, { in: inProp, timeout: defaultDuration }, (state) => (React.createElement("div", { style: Object.assign(Object.assign({}, style), transitionStyles[state]) }, children))));
};
//# sourceMappingURL=SlideDown.js.map