import { css } from '@emotion/css';
import { useRef } from 'react';
import * as React from 'react';
import { CSSTransition } from 'react-transition-group';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

type Props = {
  children: React.ReactElement;
  visible: boolean;
  duration?: number;
};

export function FadeTransition(props: Props) {
  const { visible, children, duration = 250 } = props;
  const styles = useStyles2(getStyles, duration);
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

const getStyles = (theme: GrafanaTheme2, duration: number) => ({
  enter: css({
    label: 'enter',
    opacity: 0,
  }),
  enterActive: css({
    label: 'enterActive',
    opacity: 1,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: `opacity ${duration}ms ease-out`,
    },
  }),
  exit: css({
    label: 'exit',
    opacity: 1,
  }),
  exitActive: css({
    label: 'exitActive',
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: `opacity ${duration}ms ease-out`,
    },
  }),
});
