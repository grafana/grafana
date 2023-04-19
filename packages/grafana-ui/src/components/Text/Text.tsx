import { css, cx } from '@emotion/css';
import React, { createElement, CSSProperties, useCallback } from 'react';

import { GrafanaTheme2, ThemeTypographyVariantTypes } from '@grafana/data';

import { useStyles2 } from '../../themes';

interface TextProps {
  /** Defines what HTML element is defined underneath, also maps into a default typography variant */
  as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'p' | 'legend';
  /** What typograpy variant should be used for the component. Only use if default variant for the defined 'as' is not what is needed */
  variant?: keyof ThemeTypographyVariantTypes;
  /** Override the default weight for the used variant */
  weight?: 'light' | 'regular' | 'medium' | 'bold';
  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'] | 'error' | 'success' | 'warning' | 'info';
  /** Use to cut the text off with ellipsis if there isn't space to show all of it. On hover shows the rest of the text */
  truncate?: boolean;
  /** Whether to align the text to left, center or right */
  textAlignment?: CSSProperties['textAlign'];
  /** Margin to set on the component */
  margin?: string | number;
  className?: string;
  children: React.ReactNode;
}

export const Text = ({
  as = 'span',
  variant,
  weight,
  color,
  truncate,
  textAlignment,
  margin,
  className,
  children,
}: TextProps) => {
  const variantStyles = useStyles2(
    useCallback(
      (theme) => {
        if (variant === undefined) {
          if (as === 'span' || as === 'legend') {
            return theme.typography.bodySmall;
          } else if (as === 'p') {
            return theme.typography.body;
          } else {
            return theme.typography[as];
          }
        } else {
          return variant;
        }
      },
      [as, variant]
    )
  );
  const styles = useStyles2(
    useCallback(
      (theme) => getTextStyles(theme, color, weight, truncate, textAlignment, margin),
      [color, margin, textAlignment, truncate, weight]
    )
  );

  return createElement(
    as,
    {
      className: cx(className, styles, variantStyles),
    },
    children
  );
};

Text.displayName = 'Text';

const getTextStyles = (
  theme: GrafanaTheme2,
  color?: TextProps['color'],
  weight?: TextProps['weight'],
  truncate?: TextProps['truncate'],
  textAlignment?: TextProps['textAlignment'],
  margin?: TextProps['margin'],
  variant?: keyof ThemeTypographyVariantTypes
) => {
  const customWeight = () => {
    switch (weight) {
      case 'bold':
        return theme.typography.fontWeightBold;
      case 'medium':
        return theme.typography.fontWeightMedium;
      case 'light':
        return theme.typography.fontWeightLight;
      default:
        return theme.typography.fontWeightRegular;
    }
  };

  const customColor = () => {
    switch (color) {
      case 'error':
        return theme.colors.error.text;
      case 'success':
        return theme.colors.success.text;
      case 'info':
        return theme.colors.info.text;
      case 'warning':
        return theme.colors.warning.text;
      default:
        return color ? theme.colors.text[color] : undefined;
    }
  };

  const customVariant = () => {
    switch (variant) {
      case 'h1':
        return theme.typography.h1;
      case 'h2':
        return theme.typography.h2;
      case 'h3':
        return theme.typography.h3;
      case 'h4':
        return theme.typography.h4;
      case 'h5':
        return theme.typography.h5;
      case 'h6':
        return theme.typography.h6;
      case 'bodySmall':
        return theme.typography.bodySmall;
      default:
        return theme.typography.body;
    }
  };

  return css([
    color && {
      color: customColor(),
    },
    weight && {
      fontWeight: customWeight(),
    },
    truncate && {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    margin && {
      margin,
    },
    textAlignment && {
      textAlign: textAlignment,
    },
    variant && {
      ...customVariant(),
    },
  ]);
};
