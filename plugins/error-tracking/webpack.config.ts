import CopyWebpackPlugin from 'copy-webpack-plugin';
import type { Configuration } from 'webpack';
import { mergeWithCustomize, unique } from 'webpack-merge';

import grafanaConfig, { type Env } from '@grafana/plugin-configs/webpack.config.ts';

const config = async (env: Env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env, import.meta.dirname);

  return mergeWithCustomize({
    customizeArray: unique('plugins', ['CopyPlugin'], (plugin) => plugin.constructor && plugin.constructor.name),
  })(baseConfig, {
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: 'README.md', to: '.', force: true },
          { from: 'plugin.json', to: '.' },
          { from: '**/*.svg', to: '.', noErrorOnMissing: true },
        ],
      }),
    ],
    externals: [...(baseConfig.externals as any), 'i18next'],
  });
};

export default config;
