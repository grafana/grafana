import tinycolor from 'tinycolor2';

import { GrafanaTheme, GrafanaTheme2 } from '@grafana/data';

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
  const firstColor = isTheme2 ? theme.colors.background.canvas : theme.colors.bodyBg;
  const secondColor = isTheme2 ? theme.colors.primary.main : theme.colors.formFocusOutline;

  return `
  outline: 2px dotted transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px ${firstColor}, 0 0 0px 4px ${secondColor};
  transition-property: outline, outline-offset, box-shadow;
  transition-duration: 0.2s;
  transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);`;
};

export function getMouseFocusStyles(theme: GrafanaTheme | GrafanaTheme2) {
  return {
    outline: 'none',
    boxShadow: `none`,
  };
}

export function getFocusStyles(theme: GrafanaTheme2) {
  return {
    outline: '2px dotted transparent',
    outlineOffset: '2px',
    boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
    transitionTimingFunction: `cubic-bezier(0.19, 1, 0.22, 1)`,
    transitionDuration: '0.2s',
    transitionProperty: 'outline, outline-offset, box-shadow',
  };
}

// max-width is set up based on .grafana-tooltip class that's used in dashboard
export const getTooltipContainerStyles = (theme: GrafanaTheme2) => ({
  overflow: 'hidden',
  background: theme.colors.background.elevated,
  boxShadow: theme.shadows.z2,
  maxWidth: '800px',
  padding: theme.spacing(1),
  borderRadius: theme.shape.radius.default,
  zIndex: theme.zIndex.tooltip,
});

interface ExternalRadiusAdditionalOptions {
  selfBorderWidth?: number;
  childBorderRadius?: number;
}
/**
 * Calculates a border radius for an element, based on border radius of its child.
 *
 * @param theme
 * @param offset - The distance to offset from the child element, should be >= 0.
 * @param additionalOptions
 * @param additionalOptions.selfBorderWidth - The border width of the element itself (default: 1)
 * @param additionalOptions.childBorderRadius - The border radius of the child element (default: theme default radius)
 * @returns A CSS calc() expression that returns the relative external radius value
 */
export const getExternalRadius = (
  theme: GrafanaTheme2,
  offset: number,
  additionalOptions: ExternalRadiusAdditionalOptions = {}
) => {
  const { selfBorderWidth = 1, childBorderRadius } = additionalOptions;

  const childBorderRadiusPx = childBorderRadius !== undefined ? `${childBorderRadius}px` : theme.shape.radius.default;
  return `calc(max(0px, ${childBorderRadiusPx} + ${offset}px + ${selfBorderWidth}px))`;
};

interface InternalRadiusAdditionalOptions {
  parentBorderWidth?: number;
  parentBorderRadius?: number;
}

/**
 * Calculates a border radius for an element, based on border radius of its parent.
 *
 * @param theme
 * @param offset - The distance to offset from the parent element, should be >= 0.
 * @param additionalOptions
 * @param additionalOptions.parentBorderWidth - The border width of the parent element (default: 1)
 * @param additionalOptions.parentBorderRadius - The border radius of the parent element (default: theme default radius)
 * @returns A CSS calc() expression that returns the relative internal radius value
 */
export const getInternalRadius = (
  theme: GrafanaTheme2,
  offset: number,
  additionalOptions: InternalRadiusAdditionalOptions = {}
) => {
  const { parentBorderWidth = 1, parentBorderRadius } = additionalOptions;

  const parentBorderRadiusPx =
    parentBorderRadius !== undefined ? `${parentBorderRadius}px` : theme.shape.radius.default;
  return `calc(max(0px, ${parentBorderRadiusPx} - ${offset}px - ${parentBorderWidth}px))`;
};
