import { getBuiltInThemes } from '@grafana/data';

export function getSelectableThemes() {
  const allowedExtraThemes = [
    'catppuccin_latte',
    'catppuccin_frappe',
    'catppuccin_macchiato',
    'catppuccin_mocha',
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
