import { mergeRsbuildConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import type { StorybookConfig } from 'storybook-react-rsbuild';
import { copyAssetsSync } from './copyAssets.ts';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

copyAssetsSync();

const config: StorybookConfig = {
  stories: ['../src/**/*.story.tsx'],
  framework: {
    name: 'storybook-react-rsbuild',
    options: {},
  },
  staticDirs: ['static'],
  rsbuildFinal: async (config) =>
    mergeRsbuildConfig(config, {
      // pluginReact provides the automatic JSX runtime and, in dev, React Fast Refresh.
      // Neither storybook-react-rsbuild nor storybook-builder-rsbuild registers it.
      plugins: [pluginReact()],

      source: {
        // Define process.env for browser context
        define: {
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
          'process.env.STORYBOOK_THEME': JSON.stringify(process.env.STORYBOOK_THEME || 'system'),
        },
      },

      tools: {
        rspack: (rspackConfig) => {
          // Rsbuild's own CSS pipeline has no `lazyStyleTag` equivalent, so the theme
          // stylesheets get their own chain. `url: false` keeps relative url() refs
          // (fonts, checkbox sprites) unresolved so they resolve at runtime against the
          // assets copyAssets.ts puts in staticDirs.
          rspackConfig.module ??= {};
          rspackConfig.module.rules ??= [];
          rspackConfig.module.rules.push({
            test: /\.scss$/,
            type: 'javascript/auto',
            use: [
              {
                loader: require.resolve('style-loader'),
                options: {
                  // this is required for theme switching .use() and .unuse()
                  injectType: 'lazyStyleTag',
                },
              },
              {
                loader: require.resolve('css-loader'),
                options: {
                  url: false,
                  importLoaders: 2,
                },
              },
              {
                loader: require.resolve('sass-loader'),
                options: {
                  sassOptions: {
                    // silencing these warnings since we're planning to remove sass when angular is gone
                    silenceDeprecations: ['import', 'global-builtin'],
                  },
                },
              },
            ],
          });

          // Tell storybook to resolve imports with the @grafana-app/source condition for
          // the packages in this repo. Set here rather than via rsbuild's
          // resolve.conditionNames, which replaces the defaults instead of extending them.
          rspackConfig.resolve ??= {};
          if (Array.isArray(rspackConfig.resolve.conditionNames)) {
            rspackConfig.resolve.conditionNames.unshift('@grafana-app/source');
          } else {
            rspackConfig.resolve.conditionNames = ['@grafana-app/source', '...'];
          }

          return rspackConfig;
        },
      },
    }),
};

export default config;
