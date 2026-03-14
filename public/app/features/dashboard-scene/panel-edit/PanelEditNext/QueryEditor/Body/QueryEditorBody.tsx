import { css, cx } from '@emotion/css';
import { CSSTransition } from 'react-transition-group';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CONTENT_SIDE_BAR } from '../../constants';
import { CardEditorRenderer } from '../CardEditorRenderer';
import { useQueryEditorUIContext } from '../QueryEditorContext';

import { QueryEditorDetailsSidebar } from './QueryEditorDetailsSidebar';

export function QueryEditorBody() {
  const styles = useStyles2(getStyles);
  const { queryOptions } = useQueryEditorUIContext();
  const { isQueryOptionsOpen } = queryOptions;

  return (
    <div className={styles.container}>
      <div className={cx(styles.scrollableContent, { [styles.scrollableContentBlurred]: isQueryOptionsOpen })}>
        <CardEditorRenderer />
      </div>
      <CSSTransition
        classNames={styles.sidebarTransition}
        in={isQueryOptionsOpen}
        mountOnEnter
        timeout={CONTENT_SIDE_BAR.sidebarTransitionMs}
        unmountOnExit
      >
        <div className={styles.sidebar}>
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
    scrollableContent: css({
      flex: 1,
      minWidth: 0,
      overflow: 'auto',
      padding: theme.spacing(2),
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create('filter', {
          duration: CONTENT_SIDE_BAR.sidebarTransitionMs,
          easing: theme.transitions.easing.easeInOut,
        }),
      },
    }),
    scrollableContentBlurred: css({
      filter: 'blur(10px)',
      pointerEvents: 'none',
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
