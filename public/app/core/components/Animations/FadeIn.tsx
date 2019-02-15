import React, { FC } from 'react';
import Transition, { ExitHandler } from 'react-transition-group/Transition';

interface Props {
  duration: number;
  children: JSX.Element;
  in: boolean;
  unmountOnExit?: boolean;
  onExited?: ExitHandler;
}

export const FadeIn: FC<Props> = props => {
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
    <Transition
      in={props.in}
      timeout={props.duration}
      unmountOnExit={props.unmountOnExit || false}
      onExited={props.onExited}
    >
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
