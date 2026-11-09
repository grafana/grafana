import { config } from '@grafana/runtime';

// Comes from the `app_mode` setting in the Grafana config (defaults to "development")
// Can be set with the `GF_DEFAULT_APP_MODE` environment variable
export const isGrafanaDevMode = () => config.buildInfo.env === 'development';
