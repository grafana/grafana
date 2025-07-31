import { css } from '@emotion/css';
import { useRef } from 'react';
import * as React from 'react';
import { CSSTransition } from 'react-transition-group';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

type Props = {
  children: React.ReactElement;
  visible: boolean;
  size: number;

  duration?: number;
  horizontal?: boolean;
};

export function SlideOutTransition(props: Props) {
  const { visible, children, duration = 250, horizontal, size } = props;
  const styles = useStyles2(getStyles, duration, horizontal ? 'width' : 'height', size);
  const transitionRef = useRef(null);

  return (
    <CSSTransition
      in={visible}
      mountOnEnter={true}
      unmountOnExit={true}
      timeout={duration}
      classNames={styles}
      nodeRef={transitionRef}
    >
      {React.cloneElement(children, { ref: transitionRef })}
    </CSSTransition>
  );
}

const getStyles = (theme: GrafanaTheme2, duration: number, measurement: 'width' | 'height', size: number) => ({
  enter: css({
    label: 'enter',
    [`${measurement}`]: 0,
    opacity: 0,
  }),
  enterActive: css({
    label: 'enterActive',
    [`${measurement}`]: `${size}px`,
    opacity: 1,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: `opacity ${duration}ms ease-out, ${measurement} ${duration}ms ease-out`,
    },
    [theme.transitions.handleMotion('reduce')]: {
      transition: `opacity ${duration}ms ease-out`,
    },
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
    [theme.transitions.handleMotion('no-preference')]: {
      transition: `opacity ${duration}ms ease-out, ${measurement} ${duration}ms ease-out`,
    },
    [theme.transitions.handleMotion('reduce')]: {
      transition: `opacity ${duration}ms ease-out`,
    },
  }),
});
