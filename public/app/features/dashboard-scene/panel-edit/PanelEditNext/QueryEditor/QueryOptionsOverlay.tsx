import { css, cx } from '@emotion/css';
import { type ReactNode, useRef } from 'react';
import { CSSTransition } from 'react-transition-group';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CONTENT_SIDE_BAR } from '../constants';

import { QueryEditorDetailsSidebar } from './Body/QueryEditorDetailsSidebar';
import { useQueryEditorUIContext } from './QueryEditorContext';

interface QueryOptionsOverlayProps {
  children: ReactNode;
}

export function QueryOptionsOverlay({ children }: QueryOptionsOverlayProps) {
  const styles = useStyles2(getStyles);
  const { queryOptions } = useQueryEditorUIContext();
  const { isQueryOptionsOpen } = queryOptions;
  const transitionRef = useRef(null);

  return (
    <div className={styles.container}>
      <div className={cx(styles.content, { [styles.contentBlurred]: isQueryOptionsOpen })} inert={isQueryOptionsOpen}>
        {children}
      </div>
      <CSSTransition
        classNames={styles.sidebarTransition}
        in={isQueryOptionsOpen}
        mountOnEnter
        timeout={CONTENT_SIDE_BAR.sidebarTransitionMs}
        unmountOnExit
        nodeRef={transitionRef}
      >
        <div className={styles.sidebar} ref={transitionRef}>
          <QueryEditorDetailsSidebar />
        </div>
      </CSSTransition>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const slideTransition = theme.transitions.create('transform', {
    duration: CONTENT_SIDE_BAR.sidebarTransitionMs,
    easing: theme.transitions.easing.easeInOut,
  });

  return {
    container: css({
      position: 'relative',
      flex: 1,
      minHeight: 0,
      display: 'flex',
    }),
    content: css({
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create('filter', {
          duration: CONTENT_SIDE_BAR.sidebarTransitionMs,
          easing: theme.transitions.easing.easeInOut,
        }),
      },
    }),
    contentBlurred: css({
      filter: 'blur(10px)',
    }),
    sidebar: css({
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: CONTENT_SIDE_BAR.width,
      zIndex: theme.zIndex.sidemenu,
    }),
    sidebarTransition: {
      enter: css({ transform: 'translateX(-100%)' }),
      enterActive: css({
        transform: 'translateX(0)',
        [theme.transitions.handleMotion('no-preference')]: { transition: slideTransition },
      }),
      exit: css({ transform: 'translateX(0)' }),
      exitActive: css({
        transform: 'translateX(-100%)',
        [theme.transitions.handleMotion('no-preference')]: { transition: slideTransition },
      }),
    },
  };
};
