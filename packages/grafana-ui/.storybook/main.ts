import path, { dirname, join } from 'path';
import type { StorybookConfig } from '@storybook/react-webpack5';
// avoid importing from @grafana/data to prevent node error: ERR_REQUIRE_ESM
import { availableIconsIndex, IconName } from '../../grafana-data/src/types/icon';
import { getIconSubDir } from '../src/components/Icon/utils';

// Internal stories should only be visible during development
const storyGlob =
  process.env.NODE_ENV === 'production'
    ? '../src/components/**/!(*.internal).story.tsx'
    : '../src/components/**/*.story.tsx';

const stories = ['../src/Intro.mdx', storyGlob];

// We limit icon paths to only the available icons so publishing
// doesn't require uploading 1000s of unused assets.
const iconPaths = Object.keys(availableIconsIndex)
  .filter((iconName) => !iconName.startsWith('fa '))
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
      },
    },
    getAbsolutePath('@storybook/addon-storysource'),
    getAbsolutePath('storybook-dark-mode'),
    getAbsolutePath('@storybook/addon-mdx-gfm'),
    getAbsolutePath('@storybook/addon-webpack5-compiler-swc'),
  ],
  core: {},
  docs: {
    autodocs: true,
  },
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

    // use the asset module for SVGS for compatibility with grafana/ui Icon component.
    config.module?.rules?.push({
      test: /(unicons|mono|custom)[\\/].*\.svg$/,
      type: 'asset/source',
    });

    return config;
  },
};
module.exports = mainConfig;

function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}
