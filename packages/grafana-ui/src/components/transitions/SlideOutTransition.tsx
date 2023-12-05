import { css } from '@emotion/css';
import React from 'react';
import { CSSTransition } from 'react-transition-group';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

type Props = {
  children: React.ReactNode;
  visible: boolean;
  size: number;

  duration?: number;
  horizontal?: boolean;
};

export function SlideOutTransition(props: Props) {
  const { visible, children, duration = 250, horizontal, size } = props;
  const styles = useStyles2(getStyles, duration, horizontal ? 'width' : 'height', size);

  return (
    <CSSTransition in={visible} mountOnEnter={true} unmountOnExit={true} timeout={duration} classNames={styles}>
      {children}
    </CSSTransition>
  );
}

const getStyles = (_theme: GrafanaTheme2, duration: number, measurement: 'width' | 'height', size: number) => ({
  enter: css({
    label: 'enter',
    [`${measurement}`]: 0,
    opacity: 0,
  }),
  enterActive: css({
    label: 'enterActive',
    [`${measurement}`]: `${size}px`,
    opacity: 1,
    transition: `opacity ${duration}ms ease-out, ${measurement} ${duration}ms ease-out`,
  }),
  exit: css({
    label: 'exit',
    [`${measurement}`]: `${size}px`,
    opacity: 1,
  }),
  exitActive: css({
    label: 'exitActive',
    opacity: 0,
    [`${measurement}`]: 0,
    transition: `opacity ${duration}ms ease-out, ${measurement} ${duration}ms ease-out`,
  }),
});
