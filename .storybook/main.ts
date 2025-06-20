import path, { dirname, join } from 'node:path';
import type { StorybookConfig } from '@storybook/react-webpack5';
import { copyAssetsSync } from './copyAssets';

const stories = [...packageStories('grafana-ui'), ...packageStories('grafana-alerting', 'Alerting')];

// Copy the assets required by storybook before starting the storybook server.
copyAssetsSync();

const mainConfig: StorybookConfig = {
  stories,
  addons: [
    {
      name: '@storybook/addon-essentials',
      options: {
        backgrounds: false,
      },
    },
    '@storybook/addon-a11y',
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
    '@storybook/addon-storysource',
    '@storybook/addon-webpack5-compiler-swc',
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      fastRefresh: true,
      builder: {
        fsCache: true,
      },
    },
  },
  logLevel: 'debug',
  staticDirs: ['static'],
  typescript: {
    check: true,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      tsconfigPath: path.resolve(__dirname, 'tsconfig.json'),
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
      savePropValueAsString: true,
    },
  },
  swc: () => ({
    jsc: {
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
  }),
  webpackFinal: async (config) => {
    config.target = 'web';

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
module.exports = mainConfig;

function packageStories(name: string, prefix?: string) {
  return [
    {
      titlePrefix: prefix,
      directory: `../packages/${name}/src`,
      files: 'Intro.mdx',
    },
    {
      titlePrefix: prefix,
      directory: `../packages/${name}/src`,
      files: process.env.NODE_ENV === 'production' ? '**/!(*.internal).story.tsx' : '**/*.story.tsx',
    },
  ];
}
