import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { focusCss } from '../../themes/mixins';
import { ComponentSize } from '../../types/size';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    ${focusCss(theme)}
  }
`;

export const sharedInputStyle = (theme: GrafanaTheme, invalid = false) => {
  const colors = theme.colors;
  const borderColor = invalid ? theme.palette.redBase : colors.formInputBorder;

  return css`
    background-color: ${colors.formInputBg};
    line-height: ${theme.typography.lineHeight.md};
    font-size: ${theme.typography.size.md};
    color: ${colors.formInputText};
    border: 1px solid ${borderColor};
    padding: 0 ${theme.spacing.sm} 0 ${theme.spacing.sm};

    &:-webkit-autofill,
    &:-webkit-autofill:hover {
      /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ${colors.formInputBg}!important;
      -webkit-text-fill-color: ${colors.formInputText} !important;
    }

    &:-webkit-autofill:focus {
      /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */
      box-shadow: 0 0 0 2px ${theme.colors.bodyBg}, 0 0 0px 4px ${theme.colors.formFocusOutline},
        inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ${colors.formInputBg}!important;
      -webkit-text-fill-color: ${colors.formInputText} !important;
    }

    &:hover {
      border-color: ${borderColor};
    }

    &:focus {
      outline: none;
    }

    &:disabled {
      background-color: ${colors.formInputBgDisabled};
      color: ${colors.formInputDisabledText};
    }

    &::placeholder {
      color: ${colors.formInputPlaceholderText};
      opacity: 1;
    }
  `;
};

export const inputSizes = () => {
  return {
    sm: css`
      width: ${inputSizesPixels('sm')};
    `,
    md: css`
      width: ${inputSizesPixels('md')};
    `,
    lg: css`
      width: ${inputSizesPixels('lg')};
    `,
    auto: css`
      width: ${inputSizesPixels('auto')};
    `,
  };
};

export const inputSizesPixels = (size: string) => {
  switch (size) {
    case 'sm':
      return '200px';
    case 'md':
      return '320px';
    case 'lg':
      return '580px';
    case 'auto':
    default:
      return 'auto';
  }
};

export function getPropertiesForButtonSize(size: ComponentSize, theme: GrafanaTheme) {
  const { typography, height, spacing } = theme;

  switch (size) {
    case 'sm':
      return {
        padding: spacing.base,
        fontSize: typography.size.sm,
        height: height.sm,
      };

    case 'lg':
      return {
        padding: spacing.base * 3,
        fontSize: typography.size.lg,
        height: height.lg,
      };
    case 'md':
    default:
      return {
        padding: spacing.base * 2,
        fontSize: typography.size.md,
        height: height.md,
      };
  }
}
