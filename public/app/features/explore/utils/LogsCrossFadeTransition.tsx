import React from 'react';
import memoizeOne from 'memoize-one';
import { css } from 'emotion';
import { CSSTransition } from 'react-transition-group';

const transitionDuration = 500;
// We add a bit of delay to the transition as another perf optimisation. As at the start we need to render
// quite a bit of new rows, if we start transition at the same time there can be frame rate drop. This gives time
// for react to first render them and then do the animation.
const transitionDelay = 100;

const getStyles = memoizeOne(() => {
  return {
    logsEnter: css`
      label: logsEnter;
      position: absolute;
      opacity: 0;
      height: auto;
      width: 100%;
    `,
    logsEnterActive: css`
      label: logsEnterActive;
      opacity: 1;
      transition: opacity ${transitionDuration}ms ease-out ${transitionDelay}ms;
    `,
    logsExit: css`
      label: logsExit;
      position: absolute;
      opacity: 1;
      height: auto;
      width: 100%;
    `,
    logsExitActive: css`
      label: logsExitActive;
      opacity: 0;
      transition: opacity ${transitionDuration}ms ease-out ${transitionDelay}ms;
    `,
  };
});

type Props = {
  children: React.ReactNode;
  visible: boolean;
};

/**
 * Cross fade transition component that is tied a bit too much to the logs containers so not very useful elsewhere
 * right now.
 */
export function LogsCrossFadeTransition(props: Props) {
  const { visible, children } = props;
  const styles = getStyles();
  return (
    <CSSTransition
      in={visible}
      mountOnEnter={true}
      unmountOnExit={true}
      timeout={transitionDuration + transitionDelay}
      classNames={{
        enter: styles.logsEnter,
        enterActive: styles.logsEnterActive,
        exit: styles.logsExit,
        exitActive: styles.logsExitActive,
      }}
    >
      {children}
    </CSSTransition>
  );
}
