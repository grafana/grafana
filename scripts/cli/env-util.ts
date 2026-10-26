import { parse } from 'ini';
import { existsSync, readFileSync } from 'node:fs';

const readSettings = (grafanaRoot: string) => {
  const defaultSettings = readFileSync(`${grafanaRoot}/conf/defaults.ini`, { encoding: 'utf-8' });

  const customSettings = existsSync(`${grafanaRoot}/conf/custom.ini`)
    ? readFileSync(`${grafanaRoot}/conf/custom.ini`, { encoding: 'utf-8' })
    : '';

  return { defaults: parse(defaultSettings), custom: parse(customSettings) };
};

export const getEnvConfig = (grafanaRoot: string): Record<string, unknown> => {
  const { defaults, custom } = readSettings(grafanaRoot);

  const merged = { ...defaults.frontend_dev, ...custom.frontend_dev };

  // Take all frontend keys from the ini file and prefix with `frontend_dev_`,
  // so they can be added to `process.env` elsewhere
  const env: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(merged)) {
    env[`frontend_dev_${key}`] = value;
  }

  return env;
};

/**
 * `[server] http_port`, resolved the way Grafana resolves it: the `GF_SERVER_HTTP_PORT` environment variable, then
 * custom.ini, then defaults.ini.
 */
export const getServerHttpPort = (grafanaRoot: string): string => {
  const { defaults, custom } = readSettings(grafanaRoot);

  return String(process.env.GF_SERVER_HTTP_PORT || custom.server?.http_port || defaults.server?.http_port);
};
