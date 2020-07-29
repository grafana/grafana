// Libraries
import React from 'react';
import { Resizable, ResizeCallback } from 're-resizable';
import { css, cx, keyframes } from 'emotion';

// Services & Utils
import { stylesFactory, useTheme } from '@grafana/ui';

// Types
import { GrafanaTheme } from '@grafana/data';

const drawerSlide = keyframes`
  0% {
    transform: translateY(400px);
  }

  100% {
    transform: translateY(0px);
  }
`;

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const shadowColor = theme.isLight ? theme.palette.gray4 : theme.palette.black;

  return {
    container: css`
      position: fixed !important;
      bottom: 0;
      background: ${theme.colors.pageHeaderBg};
      border-top: 1px solid ${theme.colors.formInputBorder};
      margin: 0px;
      margin-right: -${theme.spacing.md};
      margin-left: -${theme.spacing.md};
      box-shadow: 0 0 4px ${shadowColor};
      z-index: ${theme.zIndex.sidemenu};
    `,
    drawerActive: css`
      opacity: 1;
      animation: 0.5s ease-out ${drawerSlide};
    `,
    rzHandle: css`
      background: ${theme.colors.formInputBorder};
      transition: 0.3s background ease-in-out;
      position: relative;
      width: 200px !important;
      height: 7px !important;
      left: calc(50% - 100px) !important;
      top: -4px !important;
      cursor: grab;
      border-radius: 4px;
      &:hover {
        background: ${theme.colors.formInputBorderHover};
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
  const theme = useTheme();
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
