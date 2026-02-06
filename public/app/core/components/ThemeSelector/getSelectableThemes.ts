import { getBuiltInThemes } from '@grafana/data';
import { config } from '@grafana/runtime';

export function getSelectableThemes() {
  const allowedExtraThemes = [
    'deuteranopia_protanopia_dark',
    'deuteranopia_protanopia_light',
    'tritanopia_dark',
    'tritanopia_light',
  ];

  if (config.featureToggles.grafanaconThemes) {
    allowedExtraThemes.push('desertbloom');
    allowedExtraThemes.push('gildedgrove');
    allowedExtraThemes.push('sapphiredusk');
    allowedExtraThemes.push('tron');
    allowedExtraThemes.push('gloom');
  }

  return getBuiltInThemes(allowedExtraThemes);
}
