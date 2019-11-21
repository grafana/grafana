import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${theme.colors.blueLight};
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
