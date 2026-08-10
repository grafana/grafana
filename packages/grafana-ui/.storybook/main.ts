import path, { dirname, join } from 'node:path';
import { mergeRsbuildConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import type { StorybookConfig } from 'storybook-react-rsbuild';
import remarkGfm from 'remark-gfm';
import { copyAssetsSync } from './copyAssets.ts';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const coreComponentsGlobs: StorybookConfig['stories'] = [
  // Specific high-level documentation pages
  '../src/Intro.mdx',
  '../src/DesignPrinciples.mdx',
  '../src/VoiceAndTone.mdx',
  '../src/Accessibility.mdx',

  // All the other stories
  '../src/**/*.story.tsx',
];

const alertingComponentsGlobs: StorybookConfig['stories'] = [
  {
    titlePrefix: 'Alerting',
    directory: '../../grafana-alerting/src',
    files: 'Intro.mdx',
  },
  {
    titlePrefix: 'Alerting',
    directory: '../../grafana-alerting/src',
    files: process.env.NODE_ENV === 'production' ? '**/!(*.internal).story.tsx' : '**/*.story.tsx',
  },
];

const stories = [...coreComponentsGlobs, ...alertingComponentsGlobs];

// Copy the assets required by storybook before starting the storybook server.
copyAssetsSync();

const mainConfig: StorybookConfig = {
  stories,

  addons: [
    {
      name: getAbsolutePath('@storybook/addon-docs'),
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
    getAbsolutePath('@storybook/addon-a11y'),
  ],

  framework: {
    name: getAbsolutePath('storybook-react-rsbuild'),
    options: {
      builder: {
        fsCache: true,
      },
    },
  },

  logLevel: 'debug',
  staticDirs: ['static', { from: 'images', to: 'images' }],

  typescript: {
    check: true,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      tsconfigPath: path.resolve(import.meta.dirname, 'tsconfig.docgen.json'),
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
      savePropValueAsString: true,
    },
  },

  rsbuildFinal: async (config) =>
    mergeRsbuildConfig(config, {
      // pluginReact provides the automatic JSX runtime and, in dev, React Fast Refresh.
      // Neither storybook-react-rsbuild nor storybook-builder-rsbuild registers it.
      plugins: [pluginReact()],

      tools: {
        rspack: (rspackConfig) => {
          rspackConfig.module ??= {};
          rspackConfig.module.rules ??= [];
          rspackConfig.module.rules.push(
            // expose jquery as a global so jquery plugins don't break at runtime.
            {
              test: require.resolve('jquery'),
              loader: 'expose-loader',
              options: {
                exposes: ['$', 'jQuery'],
              },
            },
            // Rsbuild's own CSS pipeline has no `lazyStyleTag` equivalent, so the theme
            // stylesheets get their own chain. `url: false` keeps relative url() refs
            // (fonts, checkbox sprites) unresolved so they resolve at runtime against the
            // assets copyAssets.ts puts in staticDirs.
            {
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
            }
          );

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

  features: {
    backgrounds: false,
  },
};

function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}

export default mainConfig;
