import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';

import grafanaConfig from '@grafana/plugin-configs/webpack.config';

const config = async (env: Record<string, unknown>): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return merge(baseConfig, {
    externals: ['@kusto/monaco-kusto'],
  });
};

export default config;
