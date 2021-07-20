import { CSSObject } from '@emotion/css';
import { GrafanaTheme, GrafanaTheme2 } from '@grafana/data';
import tinycolor from 'tinycolor2';

export function cardChrome(theme: GrafanaTheme): string {
  return `
    background: ${theme.colors.bg2};
    &:hover {
      background: ${hoverColor(theme.colors.bg2, theme)};
    }
    box-shadow: ${theme.shadows.listItem};
    border-radius: ${theme.border.radius.md};
`;
}

export function hoverColor(color: string, theme: GrafanaTheme): string {
  return theme.isDark ? tinycolor(color).brighten(2).toString() : tinycolor(color).darken(2).toString();
}

export function listItem(theme: GrafanaTheme): string {
  return `
  background: ${theme.colors.bg2};
  &:hover {
    background: ${hoverColor(theme.colors.bg2, theme)};
  }
  box-shadow: ${theme.shadows.listItem};
  border-radius: ${theme.border.radius.md};
`;
}

export function listItemSelected(theme: GrafanaTheme): string {
  return `
    background: ${hoverColor(theme.colors.bg2, theme)};
    color: ${theme.colors.textStrong};
`;
}

export function mediaUp(breakpoint: string) {
  return `only screen and (min-width: ${breakpoint})`;
}

export const focusCss = (theme: GrafanaTheme) => `
  outline: 2px dotted transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px ${theme.colors.bodyBg}, 0 0 0px 4px ${theme.colors.formFocusOutline};
  transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
`;

export function getMouseFocusStyles(theme: GrafanaTheme2): CSSObject {
  return {
    outline: 'none',
    boxShadow: `none`,
  };
}

export function getFocusStyles(theme: GrafanaTheme2): CSSObject {
  return {
    outline: '2px dotted transparent',
    outlineOffset: '2px',
    boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
    transition: `all 0.2s cubic-bezier(0.19, 1, 0.22, 1)`,
  };
}

// max-width is set up based on .grafana-tooltip class that's used in dashboard
export const getTooltipContainerStyles = (theme: GrafanaTheme2) => `
  overflow: hidden;
  background: ${theme.colors.background.secondary};
  box-shadow: ${theme.shadows.z2};
  max-width: 800px;
  padding: ${theme.spacing(1)};
  border-radius: ${theme.shape.borderRadius()};
  z-index: ${theme.zIndex.tooltip};
`;
