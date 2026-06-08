import { getBuiltInThemes, type ThemeRegistryItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useFlagColorblindThemes } from '@grafana/runtime/internal';

export function useSelectableThemes(): ThemeRegistryItem[] {
  const colorblindEnabled = useFlagColorblindThemes();
  const allowedExtraThemes = [];

  if (colorblindEnabled) {
    allowedExtraThemes.push('deut_prot_dark');
    allowedExtraThemes.push('deut_prot_light');
    allowedExtraThemes.push('tritanopia_dark');
    allowedExtraThemes.push('tritanopia_light');
  }

  if (config.featureToggles.grafanaconThemes) {
    allowedExtraThemes.push('desertbloom');
    allowedExtraThemes.push('gildedgrove');
    allowedExtraThemes.push('sapphiredusk');
    allowedExtraThemes.push('tron');
    allowedExtraThemes.push('gloom');
  }

  return getBuiltInThemes(allowedExtraThemes);
}
