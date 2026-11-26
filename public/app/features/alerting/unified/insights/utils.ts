import { config } from '@grafana/runtime';

import { getAPINamespace } from '../../../../api/utils';

const themeColors = config.theme2.colors;

const SERIES_COLOR_MAPPING = {
  alerting: themeColors.error.main,
  firing: themeColors.error.main,
  active: themeColors.error.main,
  missed: themeColors.error.main,
  failed: themeColors.error.main,
  pending: themeColors.warning.main,
  recovering: themeColors.warning.main,
  nodata: themeColors.info.main,
  'active evaluation': themeColors.info.main,
  normal: themeColors.success.main,
  success: themeColors.success.main,
  error: themeColors.warning.text,
};

// ⚠️ these colors will _not_ update if user changes their theme without refreshing
export function overrideToFixedColor(key: keyof typeof SERIES_COLOR_MAPPING) {
  return {
    mode: 'fixed',
    fixedColor: SERIES_COLOR_MAPPING[key],
  };
}

export const PANEL_STYLES = { minHeight: 300 };

const namespace = getAPINamespace();

export const INSTANCE_ID = namespace.includes('stacks-') ? namespace.replace('stacks-', '') : undefined;
