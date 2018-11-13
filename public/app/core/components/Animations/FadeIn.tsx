import React, { SFC } from 'react';
import Transition from 'react-transition-group/Transition';

interface Props {
  duration: number;
  children: JSX.Element;
  in: boolean;
}

export const FadeIn: SFC<Props> = props => {
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

  return (
    <Transition in={props.in} timeout={props.duration}>
      {state => (
        <div
          style={{
            ...defaultStyle,
            ...transitionStyles[state],
          }}
        >
          {props.children}
        </div>
      )}
    </Transition>
  );
};
