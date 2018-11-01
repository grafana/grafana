import React from 'react';
import Transition from 'react-transition-group/Transition';

interface Style {
  transition?: string;
  overflow?: string;
}

// When animating using max-height we need to use a static value.
// If this is not enough, pass in <SlideDown maxHeight="....
const defaultMaxHeight = '200px';
const defaultDuration = 200;

export const defaultStyle: Style = {
  transition: `max-height ${defaultDuration}ms ease-in-out`,
  overflow: 'hidden',
};

export default ({ children, in: inProp, maxHeight = defaultMaxHeight, style = defaultStyle }) => {
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
            ...style,
            ...transitionStyles[state],
          }}
        >
          {children}
        </div>
      )}
    </Transition>
  );
};
