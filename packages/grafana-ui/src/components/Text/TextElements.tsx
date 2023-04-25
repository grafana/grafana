import React, { CSSProperties } from 'react';

import { GrafanaTheme2, ThemeTypographyVariantTypes } from '@grafana/data';

import { Text } from './Text';

interface TextElementsProps {
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

export const H1 = React.forwardRef<HTMLElement, TextElementsProps>((props, ref) => {
  return <Text as="h1" {...props} variant={props.variant || 'h1'} ref={ref} />;
});

H1.displayName = 'H1';

export const H2 = React.forwardRef<HTMLElement, TextElementsProps>((props, ref) => {
  return <Text as="h2" {...props} variant={props.variant || 'h2'} ref={ref} />;
});

H2.displayName = 'H2';

export const H3 = React.forwardRef<HTMLElement, TextElementsProps>((props, ref) => {
  return <Text as="h3" {...props} variant={props.variant || 'h3'} ref={ref} />;
});

H3.displayName = 'H3';

export const H4 = React.forwardRef<HTMLElement, TextElementsProps>((props, ref) => {
  return <Text as="h4" {...props} variant={props.variant || 'h4'} ref={ref} />;
});

H4.displayName = 'H4';

export const H5 = React.forwardRef<HTMLElement, TextElementsProps>((props, ref) => {
  return <Text as="h5" {...props} variant={props.variant || 'h5'} ref={ref} />;
});

H5.displayName = 'H5';

export const H6 = React.forwardRef<HTMLElement, TextElementsProps>((props, ref) => {
  return <Text as="h6" {...props} variant={props.variant || 'h6'} ref={ref} />;
});

H6.displayName = 'H6';

export const P = React.forwardRef<HTMLElement, TextElementsProps>((props, ref) => {
  return <Text as="p" {...props} variant={props.variant || 'body'} ref={ref} />;
});

P.displayName = 'P';

export const Span = React.forwardRef<HTMLElement, TextElementsProps>((props, ref) => {
  return <Text as="span" {...props} variant={props.variant || 'bodySmall'} ref={ref} />;
});

Span.displayName = 'Span';

export const Legend = React.forwardRef<HTMLElement, TextElementsProps>((props, ref) => {
  return <Text as="legend" {...props} variant={props.variant || 'bodySmall'} ref={ref} />;
});

Legend.displayName = 'Legend';
