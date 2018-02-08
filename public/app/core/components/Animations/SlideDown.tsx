import React from 'react';
import Transition from 'react-transition-group/Transition';

const defaultMaxHeight = '200px'; // When animating using max-height we need to use a static value.
// If this is not enough, pass in <SlideDown maxHeight="....
const defaultDuration = 200;
const defaultStyle = {
  transition: `max-height ${defaultDuration}ms ease-in-out`,
  overflow: 'hidden',
};

export default ({ children, in: inProp, maxHeight = defaultMaxHeight }) => {
  // There are 4 main states a Transition can be in:
  // ENTERING, ENTERED, EXITING, EXITED
  // https://reactcommunity.org/react-transition-group/
  const transitionStyles = {
    exited: { maxHeight: 0 },
    entering: { maxHeight: maxHeight },
    entered: { maxHeight: maxHeight, overflow: 'visible' },
    exiting: { maxHeight: 0 },
  };

  return (
    <Transition in={inProp} timeout={defaultDuration}>
      {state => (
        <div
          style={{
            ...defaultStyle,
            ...transitionStyles[state],
          }}
        >
          {children}
        </div>
      )}
    </Transition>
  );
};
