import type { Configuration } from 'webpack';

import grafanaConfig, { type Env } from '@grafana/plugin-configs/webpack.config.ts';

const config = async (env: Env): Promise<Configuration> => {
  return await grafanaConfig(env);
};

export default config;
