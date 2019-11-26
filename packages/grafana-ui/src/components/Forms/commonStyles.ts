import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    outline: 2px dotted transparent;
    outline-offset: 2px;
    box-shadow: 0 0 0 2px ${theme.colors.pageBg}, 0 0 0px 4px ${theme.colors.formFocusOutline};
    transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
  }
`;

export const sharedInputStyle = (theme: GrafanaTheme) => {
  const colors = theme.colors;

  return css`
    background-color: ${colors.formInputBg};
    line-height: ${theme.typography.lineHeight.lg};
    font-size: ${theme.typography.size.md};
    color: ${colors.formInputText};

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
