import { getBuiltInThemes } from '@grafana/data';
import { config } from '@grafana/runtime';

export function getSelectableThemes() {
  const allowedExtraThemes = ['deut_prot_dark', 'deut_prot_light', 'tritanopia_dark', 'tritanopia_light'];

  allowedExtraThemes.push('desertbloom');
  allowedExtraThemes.push('gildedgrove');
  allowedExtraThemes.push('sapphiredusk');
  allowedExtraThemes.push('tron');
  allowedExtraThemes.push('gloom');

  return getBuiltInThemes(allowedExtraThemes);
}
