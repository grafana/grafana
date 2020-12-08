import { GrafanaThemeType } from '@grafana/data';

type VariantDescriptor = { [key in GrafanaThemeType]: string | number };

/**
 * @deprecated use theme.isLight ? or theme.isDark instead
 */
export const selectThemeVariant = (variants: VariantDescriptor, currentTheme?: GrafanaThemeType) => {
  return variants[currentTheme || GrafanaThemeType.Dark];
};
