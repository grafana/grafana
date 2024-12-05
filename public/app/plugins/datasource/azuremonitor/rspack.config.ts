import type { Configuration } from '@rspack/core';
import { merge } from 'webpack-merge';

import grafanaConfig from '@grafana/plugin-configs/rspack.config';

const config = async (env: Record<string, unknown>): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return merge(baseConfig, {
    externals: ['@kusto/monaco-kusto'],
  });
};

// eslint-disable-next-line no-barrel-files/no-barrel-files
export default config;
