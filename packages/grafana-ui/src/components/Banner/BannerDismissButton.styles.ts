import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { getButtonFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { darkenColor, emphasizeColor, lightenColor } from '../../utils/cssColor';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';

// The same step the theme takes from a solid button's background to its hover background: backgroundEmphasis in the
// refresh themes, which darkens a light color and lightens a dark one, and shade in the others, which follows the
// theme mode.
function getHoverBackgroundColor(theme: GrafanaTheme2, color: string) {
  const { tonalOffset } = theme.colors;

  if (theme.flags.visualDesignRefresh) {
    return emphasizeColor(color, tonalOffset);
  }

  return theme.isLight ? darkenColor(color, tonalOffset) : lightenColor(color, tonalOffset);
}

export const getStyles = (theme: GrafanaTheme2, backgroundColor: string, textColor: string, iconOnly: boolean) => {
  const { height, padding, fontSize } = getPropertiesForButtonSize('md', theme);
  const focusStyle = getButtonFocusStyles(theme);
  const paddingMinusBorder = theme.spacing.gridSize * padding - 1;

  return {
    button: css({
      label: 'button',
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      fontSize,
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
      background: backgroundColor,
      color: textColor,
      border: '1px solid transparent',
      '&:hover': {
        background: getHoverBackgroundColor(theme, backgroundColor),
        color: textColor,
        borderColor: 'transparent',
      },
      '&:active': {
        background: backgroundColor,
      },

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },
    }),
    icon: iconOnly
      ? css({
          // Important not to set margin bottom here as it would override internal icon bottom margin
          marginRight: theme.spacing(-padding / 2),
          marginLeft: theme.spacing(-padding / 2),
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
