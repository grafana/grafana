import { css } from '@emotion/css';
import { createElement, CSSProperties } from 'react';
import * as React from 'react';

import { GrafanaTheme2, ThemeTypographyVariantTypes } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { TruncatedText } from './TruncatedText';
import { customWeight, customColor, customVariant } from './utils';

export interface TextProps extends Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style'> {
  /** Defines what HTML element is defined underneath. "span" by default */
  element?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'p' | 'li';
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
  /** If true, numbers will have fixed width, useful for displaying tabular data. False by default */
  tabular?: boolean;
  /** Whether to align the text to left, center or right */
  textAlignment?: CSSProperties['textAlign'];
  children: NonNullable<React.ReactNode>;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    { element = 'span', variant, weight, color, truncate, italic, textAlignment, children, tabular, ...restProps },
    ref
  ) => {
    const styles = useStyles2(getTextStyles, element, variant, color, weight, truncate, italic, textAlignment, tabular);

    const childElement = (ref: React.ForwardedRef<HTMLElement> | undefined) => {
      return createElement(
        element,
        {
          ...restProps,
          style: undefined, // Remove the style prop to avoid overriding the styles
          className: styles,
          // When overflowing, the internalRef is passed to the tooltip, which forwards it to the child element
          ref,
        },
        children
      );
    };

    // A 'span' is an inline element, so it can't be truncated
    // and it should be wrapped in a parent element that will show the tooltip
    if (!truncate || element === 'span') {
      return childElement(undefined);
    }

    return (
      <TruncatedText
        childElement={childElement}
        // eslint-disable-next-line react/no-children-prop
        children={children}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

const getTextStyles = (
  theme: GrafanaTheme2,
  element?: TextProps['element'],
  variant?: keyof ThemeTypographyVariantTypes,
  color?: TextProps['color'],
  weight?: TextProps['weight'],
  truncate?: TextProps['truncate'],
  italic?: TextProps['italic'],
  textAlignment?: TextProps['textAlignment'],
  tabular?: TextProps['tabular']
) => {
  return css([
    {
      margin: 0,
      padding: 0,
      ...customVariant(theme, element, variant),
    },
    variant && {
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
    italic && {
      fontStyle: 'italic',
    },
    textAlignment && {
      textAlign: textAlignment,
    },
    tabular && {
      fontFeatureSettings: '"tnum"',
    },
  ]);
};
