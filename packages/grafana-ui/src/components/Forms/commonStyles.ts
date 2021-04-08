import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { focusCss } from '../../themes/mixins';
import { ComponentSize } from '../../types/size';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    ${focusCss(theme)}
  }
`;

export const sharedInputStyle = (theme: GrafanaTheme, invalid = false) => {
  const palette = theme.v2.palette;
  const borderColor = invalid ? palette.error.border : palette.formComponent.border;
  const background = palette.formComponent.background;
  const textColor = palette.text.primary;

  return css`
    background-color: ${background};
    line-height: ${theme.typography.lineHeight.md};
    font-size: ${theme.typography.size.md};
    color: ${textColor};
    border: 1px solid ${borderColor};
    padding: ${theme.v2.spacing(0, 1, 0, 1)};

    &:-webkit-autofill,
    &:-webkit-autofill:hover {
      /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ${background}!important;
      -webkit-text-fill-color: ${textColor} !important;
    }

    &:-webkit-autofill:focus {
      /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */
      box-shadow: 0 0 0 2px ${theme.colors.bodyBg}, 0 0 0px 4px ${theme.colors.formFocusOutline},
        inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ${background}!important;
      -webkit-text-fill-color: ${textColor} !important;
    }

    &:hover {
      border-color: ${borderColor};
    }

    &:focus {
      outline: none;
    }

    &:disabled {
      background-color: ${palette.formComponent.disabledBackground};
      color: ${palette.text.disabled};
    }

    &::placeholder {
      color: ${palette.text.disabled};
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
