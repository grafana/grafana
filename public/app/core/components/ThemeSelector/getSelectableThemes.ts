import { getBuiltInThemes } from '@grafana/data';
import { config } from '@grafana/runtime';

export function getSelectableThemes() {
  const allowedExtraThemes = [];

  if (config.featureToggles.colorblindThemes) {
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
