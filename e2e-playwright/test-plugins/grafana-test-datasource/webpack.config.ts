import CopyWebpackPlugin from 'copy-webpack-plugin';
import grafanaConfig, { type Env } from '@grafana/plugin-configs/webpack.config.ts';
import { mergeWithCustomize, unique } from 'webpack-merge';
import { type Configuration } from 'webpack';

function skipFiles(f: string): boolean {
  if (f.includes('/dist/')) {
    // avoid copying files already in dist
    return false;
  }
  if (f.includes('/node_modules/')) {
    // avoid copying tsconfig.json
    return false;
  }
  if (f.includes('/package.json')) {
    // avoid copying package.json
    return false;
  }
  return true;
}

const config = async (env: Env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);
  const customConfig = {
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          // To `compiler.options.output`
          { from: 'README.md', to: '.', force: true },
          { from: 'plugin.json', to: '.' },
          { from: 'CHANGELOG.md', to: '.', force: true },
          { from: '**/*.json', to: '.', filter: skipFiles },
          { from: '**/*.svg', to: '.', noErrorOnMissing: true, filter: skipFiles }, // Optional
        ],
      }),
    ],
  };

  return mergeWithCustomize({
    customizeArray: unique('plugins', ['CopyPlugin'], (plugin) => plugin.constructor && plugin.constructor.name),
  })(baseConfig, customConfig);
};

export default config;
