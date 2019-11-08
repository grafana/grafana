import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant } from '../../themes';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${theme.colors.blueLight};
  }
`;

export const sharedInputStyle = (theme: GrafanaTheme) => {
  const colors = theme.colors;
  const backgroundColor = selectThemeVariant({ light: colors.white, dark: colors.gray15 }, theme.type);

  return css`
    background-color: ${backgroundColor};
    padding: 0 ${theme.spacing.formInputPaddingHorizontal};
    line-height: ${theme.typography.lineHeight.lg};
    font-size: ${theme.typography.size.md};
    color: ${selectThemeVariant({ light: colors.gray25, dark: colors.gray85 }, theme.type)};

    &:hover {
      border-color: ${selectThemeVariant({ light: colors.gray70, dark: colors.gray33 }, theme.type)};
    }

    &:focus {
      outline: none;
    }

    &:disabled {
      background-color: ${selectThemeVariant({ light: colors.gray6, dark: colors.gray10 }, theme.type)};
      color: ${selectThemeVariant({ light: colors.gray33, dark: colors.gray70 }, theme.type)};
    }
  `;
};
