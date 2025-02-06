import tinycolor from 'tinycolor2';

import { GrafanaTheme, GrafanaTheme2, colorManipulator } from '@grafana/data';

export function cardChrome(theme: GrafanaTheme2): string {
  return `
    background: ${theme.colors.background.secondary};
    &:hover {
      background: ${hoverColor(theme.colors.background.secondary, theme)};
    }
    box-shadow: ${theme.components.panel.boxShadow};
    border-radius: ${theme.shape.radius.default};
`;
}

export function hoverColor(color: string, theme: GrafanaTheme2): string {
  return theme.isDark ? tinycolor(color).brighten(2).toString() : tinycolor(color).darken(2).toString();
}

export function listItem(theme: GrafanaTheme2): string {
  return `
  background: ${theme.colors.background.secondary};
  &:hover {
    background: ${hoverColor(theme.colors.background.secondary, theme)};
  }
  box-shadow: ${theme.components.panel.boxShadow};
  border-radius: ${theme.shape.radius.default};
`;
}

export function listItemSelected(theme: GrafanaTheme2): string {
  return `
    background: ${hoverColor(theme.colors.background.secondary, theme)};
    color: ${theme.colors.text.maxContrast};
`;
}

export function mediaUp(breakpoint: string) {
  return `only screen and (min-width: ${breakpoint})`;
}

const isGrafanaTheme2 = (theme: GrafanaTheme | GrafanaTheme2): theme is GrafanaTheme2 => theme.hasOwnProperty('v1');
export const focusCss = (theme: GrafanaTheme | GrafanaTheme2) => {
  const isTheme2 = isGrafanaTheme2(theme);
  const secondColor = isTheme2 ? theme.colors.primary.main : theme.colors.formFocusOutline;

  return `
  outline: 2px dotted ${secondColor};
  outline-offset: 0px;
  box-shadow: none;
  `;
};

export function getMouseFocusStyles(theme: GrafanaTheme | GrafanaTheme2) {
  return {
    outline: 'none',
    boxShadow: `none`,
  };
}

export function getFocusStyles(theme: GrafanaTheme2, backgroundColor?: string) {
  let contrast = 1;
  let focusColor = theme.colors.primary.main;

  if (backgroundColor && backgroundColor !== 'transparent') {
    contrast = colorManipulator.getContrastRatio(backgroundColor, focusColor);

    if (contrast < 2) {
      focusColor = theme.colors.text.maxContrast;
    }
  }

  return {
    outline: `2px solid ${focusColor}`,
    outlineOffset: '0px',
    boxShadow: `none`,
  };
}

// max-width is set up based on .grafana-tooltip class that's used in dashboard
export const getTooltipContainerStyles = (theme: GrafanaTheme2) => ({
  overflow: 'hidden',
  background: theme.colors.background.secondary,
  boxShadow: theme.shadows.z2,
  maxWidth: '800px',
  padding: theme.spacing(1),
  borderRadius: theme.shape.radius.default,
  zIndex: theme.zIndex.tooltip,
});
