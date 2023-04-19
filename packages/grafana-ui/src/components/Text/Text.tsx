import { css, cx } from '@emotion/css';
import React, { createElement, CSSProperties, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

interface TextProps {
  /** Defines what HTML element is defined underneath, also maps into a default typography variant */
  as: keyof GrafanaTheme2['typography'];
  /** What typograpy variant should be used for the component. Only use if default variant for the defined 'as' is not what is needed */
  variant?: keyof GrafanaTheme2['typography'] | 'span' | undefined;
  /** Override the default weight for the used variant */
  weight: keyof GrafanaTheme2['typography'];
  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'];
  /** Use to cut the text off with ellipsis if there isn't space to show all of it. On hover shows the rest of the text */
  truncate?: boolean;
  /** Whether to align the text to left, center or right */
  textAlignment: CSSProperties['textAlign'];
  /** Margin to set on the component */
  margin?: string | number;
  className?: string;
  children: React.ReactNode;
}

export const Text = ({
  as,
  variant,
  weight,
  color,
  truncate,
  textAlignment,
  margin,
  className,
  children,
}: TextProps) => {
  const styles = useStyles2(
    useCallback(
      (theme) => getTextStyles(theme, color, weight, truncate, textAlignment, margin),
      [color, margin, textAlignment, truncate, weight]
    )
  );
  const element = variant || as;

  return createElement(
    element,
    {
      className: cx(className, styles),
      as,
      variant,
      weight,
      color,
      truncate,
      textAlignment,
      margin,
    },
    children
  );
};

Text.displayName = 'Text';

const getTextStyles = (
  theme: GrafanaTheme2,
  color: TextProps['color'] | undefined,
  weight: TextProps['weight'] | undefined,
  truncate: TextProps['truncate'] | undefined,
  textAlignment: TextProps['textAlignment'] | undefined,
  margin: TextProps['margin'] | undefined
) => {
  const customWeight = () => {
    switch (weight) {
      case 'fontWeightBold':
        return theme.typography.fontWeightBold;
      case 'fontWeightMedium':
        return theme.typography.fontWeightMedium;
      case 'fontWeightLight':
        return theme.typography.fontWeightLight;
      default:
        return theme.typography.fontWeightRegular;
    }
  };

  return css([
    color && {
      color: theme.colors.text[color],
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
  ]);
};
