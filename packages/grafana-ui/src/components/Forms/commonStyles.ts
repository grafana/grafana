import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { getFocusStyles } from '../../themes/mixins';
import { type ComponentSize } from '../../types/size';

export const getFocusStyle = (theme: GrafanaTheme2) =>
  css({
    '&:focus': getFocusStyles(theme),
  });

export const sharedInputStyle = (theme: GrafanaTheme2, invalid = false) =>
  cx(inputPadding(theme), css(getSharedInputStyles(theme, invalid)));

export const getSharedInputStyles = (theme: GrafanaTheme2, invalid = false) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  let borderColor = invalid ? theme.colors.error.border : theme.components.input.borderColor;
  let borderColorHover = invalid ? theme.colors.error.shade : theme.components.input.borderHover;
  if (visualRefreshEnabled) {
    borderColor = invalid ? theme.colors.error.border : theme.components.input.borderColor;
    borderColorHover = invalid ? theme.colors.error.borderEmphasis : theme.components.input.borderHover;
  }
  const background = theme.components.input.background;
  const textColor = theme.components.input.text;

  // Cannot use our normal borders for this color for some reason due the alpha values in them.
  // Need to colors without alpha channel
  const autoFillBorder = theme.isDark ? '#2e2f35' : '#bab4ca';

  return {
    background,
    lineHeight: theme.typography.body.lineHeight,
    minHeight: theme.spacing(theme.components.height.md),
    fontSize: theme.typography.size.md,
    color: textColor,
    border: `1px solid ${borderColor}`,

    '&:-webkit-autofill, &:-webkit-autofill:hover': {
      /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */
      boxShadow: `inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ${background}!important`,
      WebkitTextFillColor: `${textColor} !important`,
      borderColor: autoFillBorder,
    },

    '&:-webkit-autofill:focus': {
      /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */
      boxShadow: `0 0 0 2px ${theme.colors.background.primary}, 0 0 0px 4px ${theme.colors.primary.main}, inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ${background}!important`,
      WebkitTextFillColor: `${textColor} !important`,
    },

    '&:hover': {
      borderColor: borderColorHover,
    },

    '&:focus': {
      outline: 'none',
    },

    '&:disabled': {
      backgroundColor: theme.colors.action.disabledBackground,
      color: theme.colors.action.disabledText,
      border: `1px solid ${theme.colors.action.disabledBackground}`,

      '&:hover': {
        borderColor,
      },
    },

    '&::placeholder': {
      color: theme.colors.text.disabled,
      opacity: 1,
    },
  };
};

export const getCheckboxIndicatorStyles = (theme: GrafanaTheme2, invalid = false) => {
  const checkbox = theme.components.checkbox;
  const getBorderColor = (color: string) => (invalid ? theme.colors.error.border : color);

  return {
    box: {
      width: theme.spacing(2),
      height: theme.spacing(2),
      borderRadius: theme.shape.radius.sm,
      background: theme.components.input.background,
      border: `1px solid ${getBorderColor(theme.components.input.borderColor)}`,
      '&:hover': {
        cursor: 'pointer',
        borderColor: getBorderColor(theme.components.input.borderHover),
      },
    },
    checked: {
      background: checkbox.activeBackground,
      border: `1px solid ${getBorderColor(checkbox.activeBorder)}`,
      '&:hover': {
        background: checkbox.activeBackgroundHover,
        border: `1px solid ${getBorderColor(checkbox.activeBorderHover)}`,
      },
    },
    checkmark: {
      content: '""',
      position: 'absolute' as const,
      border: `solid ${checkbox.checkmarkColor}`,
      ...(theme.flags.visualDesignRefresh
        ? {
            left: theme.spacing(0.625),
            top: theme.spacing(0.125),
            width: theme.spacing(0.5),
            height: theme.spacing(1.25),
            borderWidth: '0 2px 2px 0',
            transform: 'rotate(50deg)',
          }
        : {
            left: theme.spacing(0.5),
            top: 0,
            width: theme.spacing(0.75),
            height: theme.spacing(1.5),
            borderWidth: '0 3px 3px 0',
            transform: 'rotate(45deg)',
          }),
    },
  };
};

export const inputPadding = (theme: GrafanaTheme2) => {
  return css({
    padding: theme.spacing(0, 1, 0, 1),
  });
};

export function getPropertiesForButtonSize(size: ComponentSize, theme: GrafanaTheme2) {
  switch (size) {
    case 'sm':
      return {
        padding: 1,
        fontSize: theme.typography.size.sm,
        height: theme.components.height.sm,
      };

    case 'lg':
      return {
        padding: 2,
        fontSize: theme.typography.size.lg,
        height: theme.components.height.lg,
      };
    case 'md':
    default:
      return {
        padding: 1.5,
        fontSize: theme.typography.size.md,
        height: theme.components.height.md,
      };
  }
}
