import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { type GradientButtonFill } from './GradientButton';

export const getGradientButtonStyles = (theme: GrafanaTheme2) => ({
  outline: css(getGradientButtonFillStyles(theme, 'outline')),
  solid: css(getGradientButtonFillStyles(theme, 'solid')),
});

/**
 * Styles layered on top of a secondary solid Button. The Button styles keep the size, focus ring and disabled state.
 */
export function getGradientButtonFillStyles(theme: GrafanaTheme2, fill: GradientButtonFill) {
  const gradient = theme.colors.gradients.button;
  const canvas = theme.colors.background.canvas;
  let background: string;
  let hoverBackground: string;
  let color: string;

  if (fill === 'solid') {
    const hoverOverlay = theme.colors.action.hover;
    background = `${gradient} border-box`;
    hoverBackground = `linear-gradient(${hoverOverlay}, ${hoverOverlay}) border-box, ${background}`;
    // The gradient stops are picked to contrast with the canvas, so the canvas color is also the text color.
    color = canvas;
  } else {
    const secondary = theme.colors.secondary;
    const visualRefreshEnabled = theme.flags.visualDesignRefresh;
    // The gradient fills the border box and the button color covers the padding box, leaving a 1px gradient border.
    // The canvas layer keeps a translucent button color from showing the gradient through it.
    const withGradientBorder = (fillColor: string) =>
      [
        `linear-gradient(${fillColor}, ${fillColor}) padding-box`,
        `linear-gradient(${canvas}, ${canvas}) padding-box`,
        `${gradient} border-box`,
      ].join(', ');
    background = withGradientBorder(visualRefreshEnabled ? secondary.background : secondary.main);
    hoverBackground = withGradientBorder(visualRefreshEnabled ? secondary.backgroundEmphasis : secondary.shade);
    color = secondary.contrastText;
  }

  const hoverStyles = {
    background: hoverBackground,
    color,
    // The secondary Button sets a border color on hover
    borderColor: 'transparent',
  };

  return {
    background,
    color,
    border: '1px solid transparent',

    '&:hover': {
      ...hoverStyles,
      boxShadow: theme.shadows.z1,
    },

    // No box-shadow here, as it would replace the focus ring of a keyboard focused menu trigger
    '&[aria-expanded="true"]': hoverStyles,

    '&:active': {
      background,
    },
  };
}
