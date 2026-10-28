import { type PluginDashboard } from 'app/types/plugins';

import { type GnetDashboard } from '../types';

/**
 * Type guard to distinguish GnetDashboard (grafana.com templates) from PluginDashboard.
 * GnetDashboard has additional fields like downloads, datasource, and panelTypeSlugs.
 */
export function isGnetDashboard(d: PluginDashboard | GnetDashboard): d is GnetDashboard {
  return 'datasource' in d && 'downloads' in d;
}
