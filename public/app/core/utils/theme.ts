import config from 'app/core/config';
import { GrafanaBootConfig } from '../../../../packages/grafana-runtime/src';

export const getUserThemeMode = (options?: GrafanaBootConfig) => {
  const user = options?.bootData.user || config.bootData.user;
  if (user.lightTheme) {
    return 'light';
  } else if (user.fusebitTheme) {
    return 'fusebit';
  }

  return 'dark';
};
