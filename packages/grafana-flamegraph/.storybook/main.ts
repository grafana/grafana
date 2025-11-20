import type { StorybookConfig } from '@storybook/react-webpack5';
import { copyAssetsSync } from './copyAssets.ts';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

copyAssetsSync();

const config: StorybookConfig = {
  stories: ['../src/**/*.story.tsx'],
  addons: [
    {
      name: '@storybook/preset-scss',
      options: {
        styleLoaderOptions: {
          // this is required for theme switching .use() and .unuse()
          injectType: 'lazyStyleTag',
        },
        cssLoaderOptions: {
          url: false,
          importLoaders: 2,
        },
        sassLoaderOptions: {
          sassOptions: {
            // silencing these warnings since we're planning to remove sass when angular is gone
            silenceDeprecations: ['import', 'global-builtin'],
          },
        },
      },
    },
    '@storybook/addon-webpack5-compiler-swc',
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  staticDirs: ['static'],
  webpackFinal: async (config) => {
    const webpack = await import('webpack');

    // Define process.env for browser context
    config.plugins?.push(
      new webpack.default.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        'process.env.STORYBOOK_THEME': JSON.stringify(process.env.STORYBOOK_THEME || 'system'),
      })
    );

    // expose jquery as a global so jquery plugins don't break at runtime.
    config.module?.rules?.push({
      test: require.resolve('jquery'),
      loader: 'expose-loader',
      options: {
        exposes: ['$', 'jQuery'],
      },
    });

    return config;
  },
};

export default config;
