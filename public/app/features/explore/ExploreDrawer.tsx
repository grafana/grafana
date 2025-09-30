// Libraries
import { css, cx, keyframes } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import * as React from 'react';

// Services & Utils
import { GrafanaTheme2 } from '@grafana/data';
import { getDragStyles, useStyles2, useTheme2 } from '@grafana/ui';

export interface Props {
  children: React.ReactNode;
  onResize?: ResizeCallback;
  initialHeight?: string;
}

export function ExploreDrawer(props: Props) {
  const { children, onResize, initialHeight } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const dragStyles = getDragStyles(theme);

  const width = initialHeight || `${theme.components.horizontalDrawer.defaultHeight}px`;

  return (
    <Resizable
      className={cx(styles.fixed, styles.container, styles.drawerActive)}
      defaultSize={{ width, height: '100vh' }}
      handleClasses={{ left: dragStyles.dragHandleVertical }}
      enable={{
        top: false,
        right: false,
        bottom: false,
        left: true,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      }}
      maxWidth="80vw"
      minWidth="800px"
      onResize={onResize}
    >
      {children}
    </Resizable>
  );
}

const drawerSlide = (theme: GrafanaTheme2) => keyframes`
  0% {
    transform: translateX(100%);
  }

  100% {
    transform: translateX(0px);
  }
`;

const getStyles = (theme: GrafanaTheme2) => ({
  // @ts-expect-error csstype doesn't allow !important. see https://github.com/frenic/csstype/issues/114
  fixed: css({
    position: 'absolute !important',
  }),
  container: css({
    top: 0,
    right: 0,
    height: '100vh',
    background: theme.colors.background.primary,
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    zIndex: theme.zIndex.navbarFixed,
  }),
  drawerActive: css({
    opacity: 1,
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `0.5s ease-out ${drawerSlide(theme)}`,
    },
  }),
});
