import { css } from '@emotion/css';
import React from 'react';
import { CSSTransition } from 'react-transition-group';

import { stylesFactory } from '../../themes';

const getStyles = stylesFactory((duration: number) => {
  return {
    enter: css`
      label: enter;
      opacity: 0;
    `,
    enterActive: css`
      label: enterActive;
      opacity: 1;
      transition: opacity ${duration}ms ease-out;
    `,
    exit: css`
      label: exit;
      opacity: 1;
    `,
    exitActive: css`
      label: exitActive;
      opacity: 0;
      transition: opacity ${duration}ms ease-out;
    `,
  };
});

type Props = {
  children: React.ReactNode;
  visible: boolean;
  duration?: number;
};

export function FadeTransition(props: Props) {
  const { visible, children, duration = 250 } = props;
  const styles = getStyles(duration);
  return (
    <CSSTransition in={visible} mountOnEnter={true} unmountOnExit={true} timeout={duration} classNames={styles}>
      {children}
    </CSSTransition>
  );
}
