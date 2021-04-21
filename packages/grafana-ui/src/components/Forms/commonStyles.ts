import { css } from '@emotion/css';
import { GrafanaTheme, GrafanaThemeV2 } from '@grafana/data';
import { focusCss } from '../../themes/mixins';
import { ComponentSize } from '../../types/size';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    ${focusCss(theme)}
  }
`;

export const sharedInputStyle = (theme: GrafanaThemeV2, invalid = false) => {
  const borderColor = invalid ? theme.colors.error.border : theme.components.input.border;
  const borderColorHover = invalid ? theme.colors.error.shade : theme.components.input.borderHover;
  const background = theme.components.input.background;
  const textColor = theme.components.input.text;

  return css`
    background: ${background};
    line-height: ${theme.typography.body.lineHeight};
    font-size: ${theme.typography.size.md};
    color: ${textColor};
    border: 1px solid ${borderColor};
    padding: ${theme.spacing(0, 1, 0, 1)};

    &:-webkit-autofill,
    &:-webkit-autofill:hover {
      /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ${background}!important;
      -webkit-text-fill-color: ${textColor} !important;
    }

    &:-webkit-autofill:focus {
      /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */
      box-shadow: 0 0 0 2px ${theme.colors.background.primary}, 0 0 0px 4px ${theme.colors.primary.main},
        inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ${background}!important;
      -webkit-text-fill-color: ${textColor} !important;
    }

    &:hover {
      border-color: ${borderColorHover};
    }

    &:focus {
      outline: none;
    }

    &:disabled {
      background-color: ${theme.colors.action.disabledBackground};
      color: ${theme.colors.action.disabledText};
      border: 1px solid ${theme.colors.action.disabledBackground};

      &:hover {
        border-color: ${borderColor};
      }
    }

    &::placeholder {
      color: ${theme.colors.text.disabled};
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

export function getPropertiesForButtonSize(size: ComponentSize, theme: GrafanaThemeV2) {
  switch (size) {
    case 'sm':
      return {
        padding: 1,
        fontSize: theme.typography.size.sm,
        height: theme.components.height.sm,
      };

    case 'lg':
      return {
        padding: 3,
        fontSize: theme.typography.size.lg,
        height: theme.components.height.lg,
      };
    case 'md':
    default:
      return {
        padding: 2,
        fontSize: theme.typography.size.md,
        height: theme.components.height.md,
      };
  }
}
