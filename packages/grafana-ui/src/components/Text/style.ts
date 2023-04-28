import { css } from '@emotion/css';
import { CSSProperties } from 'react';

import { GrafanaTheme2, ThemeTypographyVariantTypes } from '@grafana/data';

export interface TextStyleProps {
  /** What typograpy variant should be used for the component. Only use if default variant for the defined element is not what is needed */
  variant: keyof ThemeTypographyVariantTypes;

  /** Override the default weight for the used variant */
  weight?: 'light' | 'regular' | 'medium' | 'bold';

  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'] | 'error' | 'success' | 'warning' | 'info';

  /** Use to cut the text off with ellipsis if there isn't space to show all of it. On hover shows the rest of the text */
  truncate?: boolean;

  /** Whether to align the text to left, center or right */
  textAlignment?: CSSProperties['textAlign'];
}

export const getTextStyles = (
  theme: GrafanaTheme2,
  variant: TextStyleProps['variant'],
  color?: TextStyleProps['color'],
  weight?: TextStyleProps['weight'],
  truncate?: TextStyleProps['truncate'],
  textAlignment?: TextStyleProps['textAlignment']
) => {
  return css([
    {
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

const customWeight = (weight: TextStyleProps['weight'], theme: GrafanaTheme2): number => {
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

const customColor = (color: TextStyleProps['color'], theme: GrafanaTheme2): string | undefined => {
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
