import { css, cx, keyframes } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  children: React.ReactNode;
  onResize?: ResizeCallback;
  initialWidth?: string;
}

export function EditPaneDrawer(props: Props) {
  const { children, onResize, initialWidth } = props;
  const styles = useStyles2(getStyles);

  const width = initialWidth || `500px`;

  return (
    <Resizable
      className={cx(styles.fixed, styles.container, styles.drawerActive)}
      defaultSize={{ width: width, height: '100%' }}
      onResize={onResize}
    >
      {children}
    </Resizable>
  );
}

const drawerSlide = (theme: GrafanaTheme2) => keyframes`
  0% {
    transform: translateX(${theme.components.horizontalDrawer.defaultHeight}px);
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
    right: 0,
    background: theme.colors.background.primary,
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    zIndex: theme.zIndex.navbarFixed,
    overflow: 'scroll',
  }),
  drawerActive: css({
    opacity: 1,
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `0.2s ease-out ${drawerSlide(theme)}`,
    },
  }),
});
