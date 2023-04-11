import path from 'path';
import type { StorybookConfig } from '@storybook/react-webpack5';
// avoid importing from @grafana/data to prevent node error: ERR_REQUIRE_ESM
import { availableIconsIndex, IconName } from '../../grafana-data/src/types/icon';
import { getIconSubDir } from '../src/components/Icon/utils';

const stories = ['../src/Intro.mdx', '../src/components/**/*.story.tsx'];
if (process.env.NODE_ENV !== 'production') {
  stories.push('../src/**/*.internal.story.@(tsx|mdx)');
}

// We limit icon paths to only the available icons so publishing
// doesn't require uploading 1000s of unused assets.
const iconPaths = Object.keys(availableIconsIndex)
  .filter((iconName) => !iconName.includes('fa'))
  .map((iconName) => {
    const subDir = getIconSubDir(iconName as IconName, 'default');
    return {
      from: `../../../public/img/icons/${subDir}/${iconName}.svg`,
      to: `/public/img/icons/${subDir}/${iconName}.svg`,
    };
  });

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
      },
    },
    '@storybook/addon-storysource',
    'storybook-dark-mode',
    {
      // replace babel-loader in manager and preview with esbuild-loader
      name: 'storybook-addon-turbo-build',
      options: {
        optimizationLevel: 3,
      },
    },
    '@storybook/addon-mdx-gfm',
  ],
  core: {},
  docs: {
    autodocs: true,
  },
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
  staticDirs: [
    {
      from: '../../../public/fonts',
      to: '/public/fonts',
    },
    {
      from: '../../../public/img/grafana_text_logo-dark.svg',
      to: '/public/img/grafana_text_logo-dark.svg',
    },
    {
      from: '../../../public/img/grafana_text_logo-light.svg',
      to: '/public/img/grafana_text_logo-light.svg',
    },
    {
      from: '../../../public/img/fav32.png',
      to: '/public/img/fav32.png',
    },
    {
      from: '../../../public/lib',
      to: '/public/lib',
    },
    ...iconPaths,
  ],
  typescript: {
    check: true,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      tsconfigPath: path.resolve(__dirname, 'tsconfig.json'),
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop: any) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
      savePropValueAsString: true,
    },
  },
  webpackFinal: async (config) => {
    // expose jquery as a global so jquery plugins don't break at runtime.
    config.module?.rules?.push({
      test: require.resolve('jquery'),
      loader: 'expose-loader',
      options: {
        exposes: ['$', 'jQuery'],
      },
    });

    // use the asset module for SVGS for compatibility with grafana/ui Icon component.
    config.module?.rules?.push({
      test: /(unicons|mono|custom)[\\/].*\.svg$/,
      type: 'asset/source',
    });
    return config;
  },
};
module.exports = mainConfig;
