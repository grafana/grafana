import React from 'react';
import Transition from 'react-transition-group/Transition';
export const FadeIn = (props) => {
    const defaultStyle = {
        transition: `opacity ${props.duration}ms linear`,
        opacity: 0,
    };
    const transitionStyles = {
        exited: { opacity: 0, display: 'none' },
        entering: { opacity: 0 },
        entered: { opacity: 1 },
        exiting: { opacity: 0 },
    };
    return (React.createElement(Transition, { in: props.in, timeout: props.duration, unmountOnExit: props.unmountOnExit || false, onExited: props.onExited }, (state) => (React.createElement("div", { style: Object.assign(Object.assign({}, defaultStyle), transitionStyles[state]) }, props.children))));
};
//# sourceMappingURL=FadeIn.js.map