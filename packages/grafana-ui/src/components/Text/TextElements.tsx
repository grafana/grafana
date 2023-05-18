import React, { createElement, forwardRef, useMemo } from 'react';

import { ThemeTypographyVariantTypes } from '@grafana/data';

import { useTheme2 } from '../../themes';

import { getTextStyles, TextStyleProps } from './styles';

type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';

interface TextElementProps extends TextStyleProps {
  children: React.ReactNode;
}

function createTextElement(element: TextElement, defaultVariant: keyof ThemeTypographyVariantTypes) {
  const TextElement = forwardRef<HTMLElement, TextElementProps>(function Heading(props, ref) {
    const { children, variant, weight, fontStyle, color, truncate, textAlignment } = props;
    const theme = useTheme2();

    const styles = useMemo(() => {
      return getTextStyles(theme, {
        variant: variant ?? defaultVariant,
        weight,
        fontStyle,
        color,
        truncate,
        textAlignment,
      });
    }, [theme, variant, weight, fontStyle, color, truncate, textAlignment]);

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
