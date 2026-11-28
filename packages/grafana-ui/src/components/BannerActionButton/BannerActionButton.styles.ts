import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { getButtonFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { emphasizeColor, intensifyColor } from '../../utils/cssColor';
import { type AlertVariant } from '../Alert/Alert';

// The medium button size, in theme spacing units.
const PADDING = 1.5;

/**
 * The foreground for a saturated banner background: black in light themes and white in dark ones. Hardcoded because
 * the theme has no token that is pure black or pure white in every theme.
 */
const getSaturatedForeground = (theme: GrafanaTheme2) => (theme.isLight ? '#000000' : '#ffffff');

// The outline styles of the Button variant for a severity: destructive for error, and warning, info and success for
// the matching severities.
const getSeverityStyles = (theme: GrafanaTheme2, severity: AlertVariant) => {
  const color = theme.colors[severity];
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;

  return {
    background: 'transparent',
    color: color.text,
    border: `1px solid ${color.border}`,
    '&:hover': {
      background: visualRefreshEnabled ? color.subtleBackground : color.transparent,
      borderColor: visualRefreshEnabled ? color.borderEmphasis : emphasizeColor(color.border, 0.25),
      color: visualRefreshEnabled ? color.textEmphasis : color.text,
    },
    '&:active': {
      background: 'transparent',
    },
  };
};

// An outline in a custom color. On hover the background takes a 15% tint of the color, and the border and text move
// 25% further from mid-tones: a light color gets lighter and a dark one darker, which raises its contrast with the
// banner behind it. 25% is the step Button takes for its outline border on hover.
const getCustomColorStyles = (color: string) => {
  const hoverColor = intensifyColor(color, 0.25);

  return {
    background: 'transparent',
    color,
    border: `1px solid ${color}`,
    '&:hover': {
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      borderColor: hoverColor,
      color: hoverColor,
    },
    '&:active': {
      background: 'transparent',
    },
  };
};

const getAppearanceStyles = (theme: GrafanaTheme2, severity?: AlertVariant, customColor?: string) => {
  if (severity) {
    return getSeverityStyles(theme, severity);
  }

  return customColor ? getCustomColorStyles(customColor) : getDefaultStyles(theme);
};

const getDefaultStyles = (theme: GrafanaTheme2) => {
  const color = getSaturatedForeground(theme);

  return {
    background: 'transparent',
    color,
    border: `1px solid ${color}`,
    '&:hover': {
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      borderColor: color,
      color,
    },
    '&:active': {
      background: 'transparent',
    },
  };
};

export const getStyles = (theme: GrafanaTheme2, iconOnly: boolean, severity?: AlertVariant, customColor?: string) => {
  const height = theme.components.height.md;
  const disabledStyles = {
    cursor: 'not-allowed',
    boxShadow: 'none',
    color: theme.colors.text.disabled,
    transition: 'none',
    background: 'transparent',
    border: `1px solid ${theme.colors.border.weak}`,
  };
  const focusStyle = getButtonFocusStyles(theme);
  const paddingMinusBorder = theme.spacing.gridSize * PADDING - 1;

  return {
    button: css({
      label: 'button',
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.fontWeightMedium,
      fontFamily: theme.typography.fontFamily,
      padding: `0 ${paddingMinusBorder}px`,
      height: theme.spacing(height),
      // Deduct border from line-height for perfect vertical centering on windows and linux
      lineHeight: `${theme.spacing.gridSize * height - 2}px`,
      verticalAlign: 'middle',
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      '&:focus': focusStyle,
      '&:focus-visible': focusStyle,
      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),
      ...getAppearanceStyles(theme, severity, customColor),
      ':disabled': disabledStyles,
      '&[disabled]': disabledStyles,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },
    }),
    disabled: css(disabledStyles, {
      '&:hover': css(disabledStyles),
      '&:focus': css(disabledStyles),
      '&:focus-visible': css(disabledStyles),
    }),
    icon: iconOnly
      ? css({
          // Important not to set margin bottom here as it would override internal icon bottom margin
          marginRight: theme.spacing(-PADDING / 2),
          marginLeft: theme.spacing(-PADDING / 2),
        })
      : undefined,
    content: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      height: '100%',
    }),
  };
};
