import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { Text, TextProps } from './Text';

interface TextElementsProps extends Omit<TextProps, 'as'> {}

interface TextModifierProps {
  /** Override the default weight for the used variant */
  weight?: 'light' | 'regular' | 'medium' | 'bold';
  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'] | 'error' | 'success' | 'warning' | 'info';
  children: React.ReactNode;
}

export const H1 = React.forwardRef<HTMLHeadingElement, TextElementsProps>((props, ref) => {
  return <Text as="h1" {...props} variant={props.variant || 'h1'} ref={ref} />;
});

H1.displayName = 'H1';

export const H2 = React.forwardRef<HTMLHeadingElement, TextElementsProps>((props, ref) => {
  return <Text as="h2" {...props} variant={props.variant || 'h2'} ref={ref} />;
});

H2.displayName = 'H2';

export const H3 = React.forwardRef<HTMLHeadingElement, TextElementsProps>((props, ref) => {
  return <Text as="h3" {...props} variant={props.variant || 'h3'} ref={ref} />;
});

H3.displayName = 'H3';

export const H4 = React.forwardRef<HTMLHeadingElement, TextElementsProps>((props, ref) => {
  return <Text as="h4" {...props} variant={props.variant || 'h4'} ref={ref} />;
});

H4.displayName = 'H4';

export const H5 = React.forwardRef<HTMLHeadingElement, TextElementsProps>((props, ref) => {
  return <Text as="h5" {...props} variant={props.variant || 'h5'} ref={ref} />;
});

H5.displayName = 'H5';

export const H6 = React.forwardRef<HTMLHeadingElement, TextElementsProps>((props, ref) => {
  return <Text as="h6" {...props} variant={props.variant || 'h6'} ref={ref} />;
});

H6.displayName = 'H6';

export const P = React.forwardRef<HTMLParagraphElement, TextElementsProps>((props, ref) => {
  return <Text as="p" {...props} variant={props.variant || 'body'} ref={ref} />;
});

P.displayName = 'P';

export const Span = React.forwardRef<HTMLSpanElement, TextElementsProps>((props, ref) => {
  return <Text as="span" {...props} variant={props.variant || 'bodySmall'} ref={ref} />;
});

Span.displayName = 'Span';

export const Legend = React.forwardRef<HTMLLegendElement, TextElementsProps>((props, ref) => {
  return <Text as="legend" {...props} variant={props.variant || 'bodySmall'} ref={ref} />;
});

Legend.displayName = 'Legend';

export const TextModifier = React.forwardRef<HTMLSpanElement, TextModifierProps>((props, ref) => {
  return <Text as="span" {...props} ref={ref} />;
});

TextModifier.displayName = 'TextModifier';
