import { GrafanaTheme2, ThemeTypographyVariantTypes } from '@grafana/data';

import { TextProps } from './Text';

export const customWeight = (weight: TextProps['weight'], theme: GrafanaTheme2): number => {
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

export const customColor = (color: TextProps['color'], theme: GrafanaTheme2): string | undefined => {
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

export const customVariant = (
  theme: GrafanaTheme2,
  element: TextProps['element'],
  variant?: keyof ThemeTypographyVariantTypes
) => {
  if (variant) {
    return theme.typography[variant];
  }
  switch (element) {
    //Span elements does not have a default variant to be able to take the parents style
    case 'span':
      return;
    case 'h1':
      return theme.typography.h1;
    case 'h2':
      return theme.typography.h2;
    case 'h3':
      return theme.typography.h3;
    case 'h4':
      return theme.typography.h4;
    case 'h5':
      return theme.typography.h5;
    case 'h6':
      return theme.typography.h6;
    default:
      return theme.typography.body;
  }
};
