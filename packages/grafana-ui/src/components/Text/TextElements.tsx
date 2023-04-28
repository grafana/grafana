import React, { createElement, forwardRef, useCallback } from 'react';
import { useStyles2 } from 'src/themes';

import { ThemeTypographyVariantTypes } from '@grafana/data';

import { getTextStyles, TextStyleProps } from './style';

type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'legend';

interface TextElementProps extends TextStyleProps {
  children: React.ReactNode;
}

function createTextElement(element: TextElement, defaultVariant: keyof ThemeTypographyVariantTypes) {
  const TextElement = forwardRef<HTMLElement, TextElementProps>(function Heading(props, ref) {
    const { variant, weight, color, truncate, textAlignment, children } = props;

    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant ?? defaultVariant, color, weight, truncate, textAlignment),
        [color, textAlignment, truncate, weight, variant]
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
  });

  return TextElement;
}

export const H1 = createTextElement('h1', 'h1');
H1.displayName = 'H1';

export const H2 = createTextElement('h2', 'h2');
H2.displayName = 'H2';

export const H3 = createTextElement('h3', 'h3');
H3.displayName = 'H3';

export const H4 = createTextElement('h4', 'h4');
H4.displayName = 'H4';

export const H5 = createTextElement('h5', 'h5');
H5.displayName = 'H5';

export const H6 = createTextElement('h6', 'h6');
H6.displayName = 'H6';

export const P = createTextElement('p', 'body');
P.displayName = 'P';

export const Legend = createTextElement('legend', 'bodySmall');
Legend.displayName = 'Legend';
