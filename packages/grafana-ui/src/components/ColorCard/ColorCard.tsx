import { css, cx } from '@emotion/css';
import { type AriaRole, type HTMLAttributes } from 'react';
import * as React from 'react';

import { type ThemeTypographyVariantTypes, type GrafanaTheme2, type ThemeSpacingTokens } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';
import { type IconSize } from '../../types/icon';

export type ColorCardVariant = 'success' | 'warning' | 'error' | 'info' | 'tertiary' | 'accent';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  variant: ColorCardVariant;
  size?: 'sm' | 'md' | 'lg';
  elevated?: boolean;
}

/**
 * A color card displays information in a way that attracts the user's attention without interrupting the user's task.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/information-alert--docs
 */
export const ColorCard = React.forwardRef<HTMLDivElement, Props>(
  ({ title, children, elevated, className, variant = 'error', size = 'md', ...restProps }, ref) => {
    const theme = useTheme2();
    const styles = getStyles(theme, variant, elevated, size);
    const rolesByVariant: Record<ColorCardVariant, AriaRole> = {
      error: 'alert',
      warning: 'alert',
      info: 'status',
      success: 'status',
      tertiary: 'status',
      accent: 'status',
    };

    const role = restProps['role'] || rolesByVariant[variant];
    const ariaLabel = restProps['aria-label'] || title;

    return (
      <div ref={ref} className={cx(styles.wrapper, className)} role={role} aria-label={ariaLabel} {...restProps}>
        <div data-testid={selectors.components.Alert.alertV2(variant)} className={styles.box}></div>
      </div>
    );
  }
);

ColorCard.displayName = 'ColorCard';

function getSpacing(size: 'sm' | 'md' | 'lg'): {
  padding: number;
  iconWidth: number;
  iconSize: IconSize;
  titleVariant: keyof ThemeTypographyVariantTypes;
  titleGap: ThemeSpacingTokens;
} {
  switch (size) {
    case 'sm':
      return { padding: 1, iconWidth: 4, iconSize: 'md', titleVariant: 'h6', titleGap: 0 };
    case 'md':
      return { padding: 2, iconWidth: 5, iconSize: 'xl', titleVariant: 'h5', titleGap: 0.25 };
    case 'lg':
      return { padding: 3, iconWidth: 7, iconSize: 'xxl', titleVariant: 'h4', titleGap: 1 };
  }
}

const getStyles = (
  theme: GrafanaTheme2,
  variant: ColorCardVariant,
  elevated?: boolean,
  size: 'sm' | 'md' | 'lg' = 'md'
) => {
  const color = theme.colors[variant];
  const sizing = getSpacing(size);

  return {
    wrapper: css({
      flexGrow: 1,
      marginBottom: theme.spacing(bottomSpacing ?? 2),
      marginTop: theme.spacing(topSpacing ?? 0),
      position: 'relative',

      '&:before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        background: theme.colors.background.primary,
        borderRadius: theme.shape.radius.lg,
        zIndex: -1,
      },
    }),
    titleVariant: sizing.titleVariant,
    titleGap: sizing.titleGap,
    box: css({
      display: 'flex',
      borderRadius: theme.shape.radius.lg,
      boxShadow: elevated ? theme.shadows.z3 : undefined,
      padding: theme.spacing(sizing.padding),
      //background: `linear-gradient(345deg, ${theme.components.card.background} 20%, color-mix(in oklab, ${theme.components.card.background} 41%, ${color.background}))`,
      background: `color-mix(in oklab, ${theme.components.card.background} 60%, ${color.background})`,
      border: `1px solid color-mix(in oklab, ${theme.colors.background.page} 55%, ${color.border})`,
      gap: theme.spacing(sizing.padding),
    }),
    icon: css({
      color: color.text,
      backgroundColor: `color-mix(in oklab, ${theme.components.card.background} 40%, ${color.backgroundEmphasis})`,
      position: 'relative',
      width: theme.spacing(sizing.iconWidth),
      height: theme.spacing(sizing.iconWidth),
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    iconSize: sizing.iconSize,
    content: css({
      color: theme.colors.text.primary,
      maxHeight: '50vh',
      overflowY: 'auto',
    }),
    close: css({
      position: 'relative',
      color: theme.colors.text.secondary,
      background: 'none',
      display: 'flex',
    }),
  };
};
