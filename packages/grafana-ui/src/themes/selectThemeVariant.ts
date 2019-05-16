import { GrafanaThemeType } from '../types/theme';

type VariantDescriptor = { [key in GrafanaThemeType]: string | number };

export const selectThemeVariant = (variants: VariantDescriptor, currentTheme?: GrafanaThemeType) => {
  return variants[currentTheme || GrafanaThemeType.Dark];
};
