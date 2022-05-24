import { themesConfig } from '../../../../packages/grafana-data/src/themes/createColors';
import { getUserThemeMode } from './theme';

export function getLogLevelUnknownColor(dark: string, light: string): string {
  const mode = getUserThemeMode();
  return themesConfig[mode].base.logLevelUnknown;
}
