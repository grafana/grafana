import { css } from '@emotion/css';
import React, { createElement, CSSProperties, useCallback } from 'react';

import { GrafanaTheme2, ThemeTypographyVariantTypes } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { customWeight, customColor } from './utils';

export interface TextProps {
  /** Defines what HTML element is defined underneath */
  as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'p' | 'legend';
  /** What typograpy variant should be used for the component. Only use if default variant for the defined element is not what is needed */
  variant?: keyof ThemeTypographyVariantTypes;
  /** Override the default weight for the used variant */
  weight?: 'light' | 'regular' | 'medium' | 'bold';
  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'] | 'error' | 'success' | 'warning' | 'info';
  /** Use to cut the text off with ellipsis if there isn't space to show all of it. On hover shows the rest of the text */
  truncate?: boolean;
  /** Whether to align the text to left, center or right */
  textAlignment?: CSSProperties['textAlign'];
  children: React.ReactNode;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ as, variant, weight, color, truncate, textAlignment, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment),
        [color, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      as,
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
    textAlignment && {
      textAlign: textAlignment,
    },
  ]);
};
