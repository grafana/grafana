import { getBuiltInThemes } from '@grafana/data';

export function getSelectableThemes() {
  const allowedExtraThemes = [
    'deut_prot_dark',
    'deut_prot_light',
    'tritanopia_dark',
    'tritanopia_light',
    'desertbloom',
    'gildedgrove',
    'sapphiredusk',
    'tron',
    'gloom',
  ];

  return getBuiltInThemes(allowedExtraThemes);
}
