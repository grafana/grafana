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
    line-height: ${theme.typography.lineHeight.lg};
    font-size: ${theme.typography.size.md};
    color: ${colors.formInputText};
    border: 1px solid ${borderColor};

    &:hover {
      border-color: ${colors.formInputBorder};
    }

    &:focus {
      outline: none;
    }

    &:disabled {
      background-color: ${colors.formInputBgDisabled};
      color: ${colors.formInputDisabledText};
    }
  `;
};

export const inputSizes = () => {
  return {
    sm: css`
      width: 200px;
    `,
    md: css`
      width: 320px;
    `,
    lg: css`
      width: 580px;
    `,
    auto: css`
      width: 100%;
    `,
  };
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
