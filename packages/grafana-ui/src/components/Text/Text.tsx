import { css } from '@emotion/css';
import React, { createElement, CSSProperties, useCallback } from 'react';

import { GrafanaTheme2, ThemeTypographyVariantTypes } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface TextProps {
  /** Defines what HTML element is defined underneath. "p" by default */
  element?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'p' | 'legend';
  /** What typograpy variant should be used for the component. Only use if default variant for the defined element is not what is needed */
  variant?: keyof ThemeTypographyVariantTypes;
  /** Override the default weight for the used variant */
  weight?: 'light' | 'regular' | 'medium' | 'bold';
  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'] | 'error' | 'success' | 'warning' | 'info';
  /** Use to cut the text off with ellipsis if there isn't space to show all of it. On hover shows the rest of the text */
  truncate?: boolean;
  /** If true, show the text as italic. False by default */
  italic?: boolean;
  /** Whether to align the text to left, center or right */
  textAlignment?: CSSProperties['textAlign'];
  children: React.ReactNode;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ element = 'p', variant, weight, color, truncate, italic, textAlignment, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, italic, textAlignment),
        [color, textAlignment, truncate, italic, weight, variant]
      )
    );

    return createElement(
      element,
      {
        className: styles,
        ref,
      },
      children
    );
  }
);

Text.displayName = 'Text';

const getTextStyles = (
  theme: GrafanaTheme2,
  variant?: keyof ThemeTypographyVariantTypes,
  color?: TextProps['color'],
  weight?: TextProps['weight'],
  truncate?: TextProps['truncate'],
  italic = false,
  textAlignment?: TextProps['textAlignment']
) => {
  return css([
    variant && {
      ...theme.typography[variant],
    },
    {
      margin: 0,
      padding: 0,
    },
    color && {
      color: customColor(color, theme),
    },
    weight && {
      fontWeight: customWeight(weight, theme),
    },
    truncate && {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    italic && {
      fontStyle: 'italic',
    },
    textAlignment && {
      textAlign: textAlignment,
    },
  ]);
};

const customWeight = (weight: TextProps['weight'], theme: GrafanaTheme2): number => {
  switch (weight) {
    case 'bold':
      return theme.typography.fontWeightBold;
    case 'medium':
      return theme.typography.fontWeightMedium;
    case 'light':
      return theme.typography.fontWeightLight;
    case 'regular':
    case undefined:
      return theme.typography.fontWeightRegular;
  }
};

const customColor = (color: TextProps['color'], theme: GrafanaTheme2): string | undefined => {
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
