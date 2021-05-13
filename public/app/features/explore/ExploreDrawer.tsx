// Libraries
import React from 'react';
import { Resizable, ResizeCallback } from 're-resizable';
import { css, cx, keyframes } from '@emotion/css';

// Services & Utils
import { stylesFactory, useTheme2 } from '@grafana/ui';

// Types
import { GrafanaTheme2 } from '@grafana/data';

const drawerSlide = keyframes`
  0% {
    transform: translateY(400px);
  }

  100% {
    transform: translateY(0px);
  }
`;

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    container: css`
      position: fixed !important;
      bottom: 0;
      background: ${theme.colors.background.primary};
      border-top: 1px solid ${theme.colors.border.weak};
      margin: ${theme.spacing(0, -2, 0, -2)};
      box-shadow: ${theme.shadows.z3};
      z-index: ${theme.zIndex.sidemenu};
    `,
    drawerActive: css`
      opacity: 1;
      animation: 0.5s ease-out ${drawerSlide};
    `,
    rzHandle: css`
      background: ${theme.colors.secondary.main};
      transition: 0.3s background ease-in-out;
      position: relative;
      width: 200px !important;
      height: 7px !important;
      left: calc(50% - 100px) !important;
      top: -4px !important;
      cursor: grab;
      border-radius: 4px;
      &:hover {
        background: ${theme.colors.secondary.shade};
      }
    `,
  };
});

export interface Props {
  width: number;
  children: React.ReactNode;
  onResize?: ResizeCallback;
}

export function ExploreDrawer(props: Props) {
  const { width, children, onResize } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);
  const drawerWidth = `${width + 31.5}px`;

  return (
    <Resizable
      className={cx(styles.container, styles.drawerActive)}
      defaultSize={{ width: drawerWidth, height: '400px' }}
      handleClasses={{ top: styles.rzHandle }}
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
