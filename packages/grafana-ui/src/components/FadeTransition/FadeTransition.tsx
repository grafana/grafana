import React from 'react';
import memoizeOne from 'memoize-one';
import { css } from 'emotion';
import { CSSTransition } from 'react-transition-group';

const transitionDuration = 500;

const getStyles = memoizeOne(() => {
  return {
    enter: css`
      label: enter;
      opacity: 0;
    `,
    enterActive: css`
      label: enterActive;
      opacity: 1;
      transition: opacity ${transitionDuration}ms ease-out;
    `,
    exit: css`
      label: exit;
      opacity: 1;
    `,
    exitActive: css`
      label: exitActive;
      opacity: 0;
      transition: opacity ${transitionDuration}ms ease-out;
    `,
  };
});

type Props = {
  children: React.ReactNode;
  visible: boolean;
};

export function FadeTransition(props: Props) {
  const { visible, children } = props;
  const styles = getStyles();
  return (
    <CSSTransition
      in={visible}
      mountOnEnter={true}
      unmountOnExit={true}
      timeout={transitionDuration}
      classNames={styles}
    >
      {children}
    </CSSTransition>
  );
}
