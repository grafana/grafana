import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';

// @ts-ignore - node needs the extension to strip types successfully
import grafanaConfig from '@grafana/plugin-configs/webpack.config.ts';

const config = async (env: Record<string, unknown>): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return merge(baseConfig, {
    externals: ['@kusto/monaco-kusto', 'i18next'],
  });
};

export default config;
