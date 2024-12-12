import path, { dirname, join } from 'node:path';
import type { StorybookConfig } from '@storybook/react-webpack5';
import { copyAssetsSync } from './copyAssets';

// Internal stories should only be visible during development
const storyGlob =
  process.env.NODE_ENV === 'production'
    ? '../src/components/**/!(*.internal).story.tsx'
    : '../src/components/**/*.story.tsx';

const stories = ['../src/Intro.mdx', storyGlob];

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
    getAbsolutePath('@storybook/addon-a11y'),
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
    getAbsolutePath('@storybook/addon-storysource'),
    getAbsolutePath('storybook-dark-mode'),
    getAbsolutePath('@storybook/addon-webpack5-compiler-swc'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-webpack5'),
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

function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}
