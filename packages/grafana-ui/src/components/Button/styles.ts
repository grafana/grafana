import tinycolor from 'tinycolor2';
import { css } from 'emotion';
import { selectThemeVariant, stylesFactory } from '../../themes';
import { StyleDeps, ButtonSize } from './types';
import { GrafanaTheme } from '@grafana/data';

const buttonVariantStyles = (
  from: string,
  to: string,
  textColor: string,
  textShadowColor = 'rgba(0, 0, 0, 0.1)',
  invert = false
) => css`
  background: linear-gradient(to bottom, ${from}, ${to});
  color: ${textColor};
  text-shadow: 0 ${invert ? '1px' : '-1px'} ${textShadowColor};
  &:hover {
    background: ${from};
    color: ${textColor};
  }

  &:focus {
    background: ${from};
    outline: none;
  }
`;

export const getButtonStyles = stylesFactory(({ theme, size, variant, textAndIcon }: StyleDeps) => {
  const borderRadius = theme.border.radius.sm;
  const { padding, fontSize, height, fontWeight } = calculateMeasures(theme, size, !!textAndIcon);

  let background;

  switch (variant) {
    case 'primary':
      background = buttonVariantStyles(theme.colors.greenBase, theme.colors.greenShade, theme.colors.white);
      break;

    case 'secondary':
      background = buttonVariantStyles(theme.colors.blueBase, theme.colors.blueShade, theme.colors.white);
      break;

    case 'danger':
      background = buttonVariantStyles(theme.colors.redBase, theme.colors.redShade, theme.colors.white);
      break;

    case 'inverse':
      const from = selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark6 }, theme.type) as string;
      const to = selectThemeVariant(
        {
          light: tinycolor(from)
            .darken(5)
            .toString(),
          dark: tinycolor(from)
            .lighten(4)
            .toString(),
        },
        theme.type
      ) as string;

      background = buttonVariantStyles(from, to, theme.colors.link, 'rgba(0, 0, 0, 0.1)', true);
      break;

    case 'transparent':
      background = css`
        ${buttonVariantStyles('', '', theme.colors.link, 'rgba(0, 0, 0, 0.1)', true)};
        background: transparent;
      `;
      break;

    case 'link':
      background = css`
        ${buttonVariantStyles('', '', theme.colors.linkExternal, 'rgba(0, 0, 0, 0.1)', true)};
        background: transparent;
      `;
      break;
  }

  return {
    button: css`
      label: button;
      display: inline-flex;
      align-items: center;
      font-weight: ${fontWeight};
      font-size: ${fontSize};
      font-family: ${theme.typography.fontFamily.sansSerif};
      line-height: ${theme.typography.lineHeight.xs};
      padding: ${padding};
      vertical-align: middle;
      cursor: pointer;
      border: none;
      height: ${height};
      border-radius: ${borderRadius};
      ${background};

      &[disabled],
      &:disabled {
        cursor: not-allowed;
        opacity: 0.65;
        box-shadow: none;
      }
    `,
    iconWrap: css`
      label: button-icon-wrap;
      & + * {
        margin-left: ${theme.spacing.sm};
      }
    `,
  };
});

type ButtonMeasures = {
  padding: string;
  fontSize: string;
  height: string;
  fontWeight: number;
};

const calculateMeasures = (theme: GrafanaTheme, size: ButtonSize, textAndIcon: boolean): ButtonMeasures => {
  switch (size) {
    case 'sm': {
      return {
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        fontSize: theme.typography.size.sm,
        height: theme.height.sm,
        fontWeight: theme.typography.weight.semibold,
      };
    }

    case 'md': {
      const leftPadding = textAndIcon ? theme.spacing.sm : theme.spacing.md;

      return {
        padding: `${theme.spacing.sm} ${theme.spacing.md} ${theme.spacing.sm} ${leftPadding}`,
        fontSize: theme.typography.size.md,
        height: theme.height.md,
        fontWeight: theme.typography.weight.semibold,
      };
    }

    case 'lg': {
      const leftPadding = textAndIcon ? theme.spacing.md : theme.spacing.lg;

      return {
        padding: `${theme.spacing.md} ${theme.spacing.lg} ${theme.spacing.md} ${leftPadding}`,
        fontSize: theme.typography.size.lg,
        height: theme.height.lg,
        fontWeight: theme.typography.weight.regular,
      };
    }

    default: {
      const leftPadding = textAndIcon ? theme.spacing.sm : theme.spacing.md;

      return {
        padding: `${theme.spacing.sm} ${theme.spacing.md} ${theme.spacing.sm} ${leftPadding}`,
        fontSize: theme.typography.size.base,
        height: theme.height.md,
        fontWeight: theme.typography.weight.regular,
      };
    }
  }
};
