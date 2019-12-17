import { config, GrafanaBootConfig } from '@grafana/runtime';
// Legacy binding paths
export { config, GrafanaBootConfig as Settings };

let configMock: Partial<GrafanaBootConfig> | null = null;

export default config;

export const getConfig = () => {
  return configMock || config;
};

export const mockConfig = (mock: Partial<GrafanaBootConfig>) => {
  configMock = mock;
  return () => {
    configMock = null;
  };
};
