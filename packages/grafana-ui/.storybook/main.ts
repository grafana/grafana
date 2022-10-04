const path = require('path');

const stories = ['../src/**/*.story.@(tsx|mdx)'];

if (process.env.NODE_ENV !== 'production') {
  stories.push('../src/**/*.story.internal.@(tsx|mdx)');
}

const mainConfig = {
  stories,
  addons: [
    {
      // work around docs 6.5.x not resolving correctly with yarn PnP
      name: path.dirname(require.resolve('@storybook/addon-docs/package.json')),
      options: {
        configureJSX: true,
        babelOptions: {},
      },
    },
    {
      name: '@storybook/addon-essentials',
      options: {
        backgrounds: false,
        // work around docs 6.5.x not resolving correctly with yarn PnP
        docs: false,
      },
    },
    '@storybook/addon-a11y',
    '@storybook/addon-knobs',
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
  ],
  core: {
    builder: {
      name: 'webpack5',
      options: {
        fsCache: true,
      },
    },
  },
  features: {
    previewMdx2: true,
  },
  framework: '@storybook/react',
  logLevel: 'debug',
  reactOptions: {
    fastRefresh: true,
  },
  staticDirs: [
    { from: '../../../public/fonts', to: '/fonts' },
    { from: '../../../public/img', to: '/public/img' },
    { from: '../../../public/lib', to: '/public/lib' },
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
  webpackFinal: async (config: any) => {
    // expose jquery as a global so jquery plugins don't break at runtime.
    config.module.rules.push({
      test: require.resolve('jquery'),
      loader: 'expose-loader',
      options: {
        exposes: ['$', 'jQuery'],
      },
    });

    // use the raw-loader for SVGS for compatibility with grafana/ui Icon component.
    config.module.rules.push({
      test: /(unicons|mono|custom)[\\/].*\.svg$/,
      type: 'asset/source',
    });

    return config;
  },
};

module.exports = mainConfig;
