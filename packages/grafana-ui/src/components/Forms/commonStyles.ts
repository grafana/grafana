import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { ButtonSize } from '../Button/types';

export const getFocusCss = (theme: GrafanaTheme) => `
  outline: 2px dotted transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px ${theme.colors.pageBg}, 0 0 0px 4px ${theme.colors.formFocusOutline};
  transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
`;

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    ${getFocusCss(theme)}
  }
`;

export const sharedInputStyle = (theme: GrafanaTheme, invalid = false) => {
  const colors = theme.colors;
  const borderColor = invalid ? colors.redBase : colors.formInputBorder;

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
    }

    &:-webkit-autofill:focus {
      /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */
      box-shadow: 0 0 0 2px ${theme.colors.pageBg}, 0 0 0px 4px ${theme.colors.formFocusOutline},
        inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ${colors.formInputBg}!important;
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

export const getPropertiesForButtonSize = (theme: GrafanaTheme, size: ButtonSize) => {
  switch (size) {
    case 'sm':
      return {
        padding: `0 ${theme.spacing.sm}`,
        fontSize: theme.typography.size.sm,
        height: theme.height.sm,
      };

    case 'md':
      return {
        padding: `0 ${theme.spacing.md}`,
        fontSize: theme.typography.size.md,
        height: `${theme.spacing.formButtonHeight}px`,
      };

    case 'lg':
      return {
        padding: `0 ${theme.spacing.lg}`,
        fontSize: theme.typography.size.lg,
        height: theme.height.lg,
      };

    default:
      return {
        padding: `0 ${theme.spacing.md}`,
        fontSize: theme.typography.size.base,
        height: theme.height.md,
      };
  }
};
