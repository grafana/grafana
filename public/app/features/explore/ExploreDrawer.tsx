// Libraries
import { css, cx, keyframes } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import React from 'react';

// Services & Utils
import { GrafanaTheme2 } from '@grafana/data';
import { getDragStyles, useStyles2, useTheme2 } from '@grafana/ui';

export interface Props {
  width: number;
  children: React.ReactNode;
  onResize?: ResizeCallback;
}

export function ExploreDrawer(props: Props) {
  const { width, children, onResize } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const dragStyles = getDragStyles(theme);
  const drawerWidth = `${width + 31.5}px`;

  return (
    <Resizable
      className={cx(styles.fixed, styles.container, styles.drawerActive)}
      defaultSize={{ width: drawerWidth, height: `${theme.components.horizontalDrawer.defaultHeight}px` }}
      handleClasses={{ top: dragStyles.dragHandleHorizontal }}
      enable={{
        top: true,
        right: false,
        bottom: false,
        left: false,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      }}
      maxHeight="100vh"
      maxWidth={drawerWidth}
      minWidth={drawerWidth}
      onResize={onResize}
    >
      {children}
    </Resizable>
  );
}

const drawerSlide = (theme: GrafanaTheme2) => keyframes`
  0% {
    transform: translateY(${theme.components.horizontalDrawer.defaultHeight}px);
  }

  100% {
    transform: translateY(0px);
  }
`;

const getStyles = (theme: GrafanaTheme2) => ({
  // @ts-expect-error csstype doesn't allow !important. see https://github.com/frenic/csstype/issues/114
  fixed: css({
    position: 'fixed !important',
  }),
  container: css({
    bottom: 0,
    background: theme.colors.background.primary,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    margin: theme.spacing(0, -2, 0, -2),
    boxShadow: theme.shadows.z3,
    zIndex: theme.zIndex.navbarFixed,
  }),
  drawerActive: css({
    opacity: 1,
    animation: `0.5s ease-out ${drawerSlide(theme)}`,
  }),
});
