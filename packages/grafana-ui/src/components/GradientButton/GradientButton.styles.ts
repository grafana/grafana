import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { getButtonFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { type ComponentSize } from '../../types/size';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';

import { type GradientButtonFill } from './GradientButton';

export const getGradientButtonStyles = (
  theme: GrafanaTheme2,
  fill: GradientButtonFill,
  size: ComponentSize,
  fullWidth: boolean,
  iconOnly: boolean
) => {
  const { height, padding, fontSize } = getPropertiesForButtonSize(size, theme);
  const focusStyle = getButtonFocusStyles(theme);
  const disabledStyles = getGradientButtonDisabledStyles(theme);

  return {
    button: css({
      label: 'gradient-button',
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      fontFamily: theme.typography.fontFamily,
      padding: `0 ${theme.spacing.gridSize * padding - 1}px`,
      height: theme.spacing(height),
      // Deduct the border from the line height for vertical centering on Windows and Linux
      lineHeight: `${theme.spacing.gridSize * height - 2}px`,
      verticalAlign: 'middle',
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      '&:focus': focusStyle,
      '&:focus-visible': focusStyle,
      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),
      ...(fullWidth && {
        flexGrow: 1,
        justifyContent: 'center',
      }),
      ...getGradientButtonFillStyles(theme, fill),
      ':disabled': disabledStyles,
      '&[disabled]': disabledStyles,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },
    }),
    // A button with a tooltip is only aria-disabled, so this class covers the states :disabled can't
    disabled: css(disabledStyles, {
      '&:hover': disabledStyles,
      '&:focus': disabledStyles,
      '&:focus-visible': disabledStyles,
      '&[aria-expanded="true"]': disabledStyles,
    }),
    icon: iconOnly
      ? css({
          // Don't set a bottom margin here, as it would override the icon's own bottom margin
          marginRight: theme.spacing(-padding / 2),
          marginLeft: theme.spacing(-padding / 2),
        })
      : undefined,
    content: css({
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      // Keep custom children in their original flex layout. Text labels use a single line box.
      '&:has(> *)': {
        display: 'flex',
        alignItems: 'center',
        height: '100%',
      },
    }),
  };
};

/** A disabled GradientButton has no gradient, and looks like any disabled solid Button. */
function getGradientButtonDisabledStyles(theme: GrafanaTheme2) {
  return {
    cursor: 'not-allowed',
    boxShadow: 'none',
    color: theme.colors.text.disabled,
    transition: 'none',
    background: theme.colors.action.disabledBackground,
    border: '1px solid transparent',
  };
}

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
    // The gradient stops are light in both modes, so the text is dark in both: the canvas in dark mode, black in light mode
    color = theme.isDark ? canvas : theme.colors.text.maxContrast;
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
