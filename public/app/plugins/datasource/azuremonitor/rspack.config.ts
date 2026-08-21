import type { Configuration } from '@rspack/core';
import { merge } from 'webpack-merge';

import grafanaConfig, { type Env } from '@grafana/plugin-configs/rspack.config.ts';

const config = async (env: Env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env, import.meta.dirname);

  return merge(baseConfig, {
    externals: ['@kusto/monaco-kusto', 'i18next'],
  });
};

export default config;
