import { css } from '@emotion/css';
import React from 'react';
import { CSSTransition } from 'react-transition-group';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

type Props = {
  children: React.ReactNode;
  visible: boolean;
  duration?: number;
};

export function FadeTransition(props: Props) {
  const { visible, children, duration = 250 } = props;
  const styles = useStyles2(getStyles, duration);

  return (
    <CSSTransition in={visible} mountOnEnter={true} unmountOnExit={true} timeout={duration} classNames={styles}>
      {children}
    </CSSTransition>
  );
}

const getStyles = (_theme: GrafanaTheme2, duration: number) => ({
  enter: css({
    label: 'enter',
    opacity: 0,
  }),
  enterActive: css({
    label: 'enterActive',
    opacity: 1,
    transition: `opacity ${duration}ms ease-out`,
  }),
  exit: css({
    label: 'exit',
    opacity: 1,
  }),
  exitActive: css({
    label: 'exitActive',
    opacity: 0,
    transition: `opacity ${duration}ms ease-out`,
  }),
});
