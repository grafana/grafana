const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const FilterWarningsPlugin = require('webpack-filter-warnings-plugin');

const stories = ['../src/**/*.story.{js,jsx,ts,tsx,mdx}'];

if (process.env.NODE_ENV !== 'production') {
  stories.push('../src/**/*.story.internal.{js,jsx,ts,tsx,mdx}');
}

module.exports = {
  stories: stories,
  addons: [
    {
      name: '@storybook/addon-essentials',
      options: {
        backgrounds: false,
      },
    },
    '@storybook/addon-a11y',
    '@storybook/addon-knobs',
    '@storybook/addon-storysource',
    'storybook-dark-mode',
  ],
  staticDirs: [
    { from: '../../../public/fonts', to: '/fonts' },
    { from: '../../../public/img', to: '/public/img' },
    { from: '../../../public/lib', to: '/public/lib' },
  ],
  reactOptions: {
    fastRefresh: true,
  },
  core: {
    builder: 'webpack5',
  },
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
  webpackFinal: async (config: any, { configType }: any) => {
    const isProductionBuild = configType === 'PRODUCTION';

    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      process: false,
    };

    // remove svg from default storybook webpack 5 config so we can use `raw-loader`
    config.module.rules = config.module.rules.map((rule: any) => {
      if (
        String(rule.test) ===
        String(/\.(svg|ico|jpg|jpeg|png|apng|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/)
      ) {
        return {
          ...rule,
          test: /\.(ico|jpg|jpeg|png|apng|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
        };
      }

      return rule;
    });

    config.module.rules = [
      ...(config.module.rules || []),
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: require.resolve('ts-loader'),
            options: {
              transpileOnly: true,
              configFile: path.resolve(__dirname, 'tsconfig.json'),
            },
          },
        ],
        exclude: /node_modules/,
        include: [path.resolve(__dirname, '../../../public/'), path.resolve(__dirname, '../../../packages/')],
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'style-loader',
            options: { injectType: 'lazyStyleTag' },
          },
          {
            loader: 'css-loader',
            options: {
              url: false,
              importLoaders: 2,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              sourceMap: false,
              postcssOptions: {
                config: path.resolve(__dirname + '../../../../scripts/webpack/postcss.config.js'),
              },
            },
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: false,
            },
          },
        ],
      },
      // for pre-caching SVGs as part of the JS bundles
      {
        test: /\.svg$/,
        use: 'raw-loader',
      },
      {
        test: require.resolve('jquery'),
        loader: 'expose-loader',
        options: {
          exposes: ['$', 'jQuery'],
        },
      },
    ];

    if (isProductionBuild) {
      config.optimization = {
        nodeEnv: 'production',
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          minChunks: 1,
          cacheGroups: {
            vendors: {
              test: /[\\/]node_modules[\\/].*[jt]sx?$/,
              chunks: 'initial',
              priority: -10,
              reuseExistingChunk: true,
              enforce: true,
            },
            default: {
              priority: -20,
              chunks: 'all',
              test: /.*[jt]sx?$/,
              reuseExistingChunk: true,
            },
          },
        },
        minimize: isProductionBuild,
        minimizer: isProductionBuild
          ? [new TerserPlugin({ parallel: false, exclude: /monaco/ }), new CssMinimizerPlugin()]
          : [],
      };
    }

    config.resolve.alias['@grafana/ui'] = path.resolve(__dirname, '..');

    // Silence "export not found" webpack warnings with transpileOnly
    // https://github.com/TypeStrong/ts-loader#transpileonly
    config.plugins.push(
      new FilterWarningsPlugin({
        exclude: /export .* was not found in/,
      })
    );

    return config;
  },
};
