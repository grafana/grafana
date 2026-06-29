import { getBuiltInThemes } from '@grafana/data';
import { getFeatureFlagClient, FlagKeys } from '@grafana/runtime/internal';

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

  if (getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaVisualDesignRefresh, false)) {
    allowedExtraThemes.push('visual_refresh_dark', 'visual_refresh_light');
  }

  return getBuiltInThemes(allowedExtraThemes);
}
