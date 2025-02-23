import rspack from '@rspack/core';
import grafanaConfig from '@grafana/plugin-configs/rspack.config';
import { mergeWithCustomize, unique } from 'webpack-merge';
import { Configuration } from 'webpack';

const config = async (env: Record<string, unknown>): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);
  const customConfig = {
    plugins: [
      new rspack.CopyRspackPlugin({
        patterns: [
          // To `compiler.options.output`
          { from: 'README.md', to: '.', force: true },
          { from: 'plugin.json', to: '.' },
          { from: 'CHANGELOG.md', to: '.', force: true },
          {
            from: '**/*.json',
            to: '.',
            globOptions: { ignore: ['**/dist/**', '**/tsconfig.json', '**/package.json', '**/project.json'] },
          },
          { from: '**/*.svg', to: '.', noErrorOnMissing: true, globOptions: { ignore: ['**/dist/**'] } }, // Optional
        ],
      }),
    ],
  };

  return mergeWithCustomize({
    customizeArray: unique(
      'plugins',
      [rspack.CopyRspackPlugin.name],
      (plugin) => plugin.constructor && plugin.constructor.name
    ),
  })(baseConfig, customConfig);
};

export default config;
