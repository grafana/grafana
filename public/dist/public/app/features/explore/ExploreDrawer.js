// Libraries
import { css, cx, keyframes } from '@emotion/css';
import { Resizable } from 're-resizable';
import React from 'react';
import { stylesFactory, useTheme2 } from '@grafana/ui';
// Types
const drawerSlide = (theme) => keyframes `
  0% {
    transform: translateY(${theme.components.horizontalDrawer.defaultHeight}px);
  }

  100% {
    transform: translateY(0px);
  }
`;
const getStyles = stylesFactory((theme) => {
    return {
        container: css `
      position: fixed !important;
      bottom: 0;
      background: ${theme.colors.background.primary};
      border-top: 1px solid ${theme.colors.border.weak};
      margin: ${theme.spacing(0, -2, 0, -2)};
      box-shadow: ${theme.shadows.z3};
      z-index: ${theme.zIndex.navbarFixed};
    `,
        drawerActive: css `
      opacity: 1;
      animation: 0.5s ease-out ${drawerSlide(theme)};
    `,
        rzHandle: css `
      background: ${theme.colors.secondary.main};
      transition: 0.3s background ease-in-out;
      position: relative;
      width: 200px !important;
      height: 7px !important;
      left: calc(50% - 100px) !important;
      top: -4px !important;
      cursor: grab;
      border-radius: ${theme.shape.radius.pill};
      &:hover {
        background: ${theme.colors.secondary.shade};
      }
    `,
    };
});
export function ExploreDrawer(props) {
    const { width, children, onResize } = props;
    const theme = useTheme2();
    const styles = getStyles(theme);
    const drawerWidth = `${width + 31.5}px`;
    return (React.createElement(Resizable, { className: cx(styles.container, styles.drawerActive), defaultSize: { width: drawerWidth, height: `${theme.components.horizontalDrawer.defaultHeight}px` }, handleClasses: { top: styles.rzHandle }, enable: {
            top: true,
            right: false,
            bottom: false,
            left: false,
            topRight: false,
            bottomRight: false,
            bottomLeft: false,
            topLeft: false,
        }, maxHeight: "100vh", maxWidth: drawerWidth, minWidth: drawerWidth, onResize: onResize }, children));
}
//# sourceMappingURL=ExploreDrawer.js.map