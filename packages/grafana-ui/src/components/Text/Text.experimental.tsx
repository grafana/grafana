import { css } from '@emotion/css';
import React, { createElement, CSSProperties, useCallback } from 'react';

import { GrafanaTheme2, ThemeTypographyVariantTypes } from '@grafana/data';

import { useStyles2 } from '../../themes';

interface TextProps {
  /** Defines what HTML element is defined underneath, also maps into a default typography variant */
  //as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'p' | 'legend';
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
  /** Margin to set on the component. Remember, it does not work with inline elements such as 'span'. */
  margin?: string | number;
  children: React.ReactNode;
}

export const H1 = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'h1', weight, color, truncate, textAlignment, margin, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment, margin),
        [color, margin, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      'h1',
      {
        className: styles,
        variant,
        ref,
      },
      children
    );
  }
);

H1.displayName = 'H1';

export const H2 = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'h2', weight, color, truncate, textAlignment, margin, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment, margin),
        [color, margin, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      'h1',
      {
        className: styles,
        variant,
        ref,
      },
      children
    );
  }
);

H2.displayName = 'H2';

export const H3 = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'h3', weight, color, truncate, textAlignment, margin, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment, margin),
        [color, margin, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      'h3',
      {
        className: styles,
        variant,
        ref,
      },
      children
    );
  }
);

H3.displayName = 'H3';

export const H4 = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'h4', weight, color, truncate, textAlignment, margin, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment, margin),
        [color, margin, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      'h4',
      {
        className: styles,
        variant,
        ref,
      },
      children
    );
  }
);

H4.displayName = 'H4';

export const H5 = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'h5', weight, color, truncate, textAlignment, margin, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment, margin),
        [color, margin, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      'h5',
      {
        className: styles,
        variant,
        ref,
      },
      children
    );
  }
);

H5.displayName = 'H5';

export const H6 = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'h6', weight, color, truncate, textAlignment, margin, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment, margin),
        [color, margin, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      'h6',
      {
        className: styles,
        variant,
        ref,
      },
      children
    );
  }
);

H6.displayName = 'H6';

export const P = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'body', weight, color, truncate, textAlignment, margin, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment, margin),
        [color, margin, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      'body',
      {
        className: styles,
        variant,
        ref,
      },
      children
    );
  }
);

P.displayName = 'P';

export const Span = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'bodySmall', weight, color, truncate, textAlignment, margin, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment, margin),
        [color, margin, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      'bodySmall',
      {
        className: styles,
        variant,
        ref,
      },
      children
    );
  }
);

Span.displayName = 'Span';

export const Legend = React.forwardRef<HTMLElement, TextProps>(
  ({ variant = 'bodySmall', weight, color, truncate, textAlignment, margin, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment, margin),
        [color, margin, textAlignment, truncate, weight, variant]
      )
    );

    return createElement(
      'bodySmall',
      {
        className: styles,
        variant,
        ref,
      },
      children
    );
  }
);

Legend.displayName = 'Legend';

const getTextStyles = (
  theme: GrafanaTheme2,
  variant: keyof ThemeTypographyVariantTypes,
  color?: TextProps['color'],
  weight?: TextProps['weight'],
  truncate?: TextProps['truncate'],
  textAlignment?: TextProps['textAlignment'],
  margin?: TextProps['margin']
) => {
  return css([
    {
      ...theme.typography[variant],
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
    margin && {
      margin,
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
