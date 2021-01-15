const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const FilterWarningsPlugin = require('webpack-filter-warnings-plugin');

const stories = ['../src/**/*.story.{js,jsx,ts,tsx,mdx}'];

if (process.env.NODE_ENV !== 'production') {
  stories.push('../src/**/*.story.internal.{js,jsx,ts,tsx,mdx}');
}

module.exports = {
  stories: stories,
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-controls',
    '@storybook/addon-knobs',
    '@storybook/addon-actions',
    'storybook-dark-mode/register',
    '@storybook/addon-storysource',
  ],
  reactOptions: {
    fastRefresh: true,
  },
  typescript: {
    check: true,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      tsconfigPath: path.resolve(__dirname, 'tsconfig.json'),
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop: any) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  webpackFinal: async (config: any, { configType }: any) => {
    const isProductionBuild = configType === 'PRODUCTION';
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
              importLoaders: 2,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              sourceMap: false,
              config: { path: __dirname + '../../../../scripts/webpack/postcss.config.js' },
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
      {
        test: require.resolve('jquery'),
        use: [
          {
            loader: 'expose-loader',
            query: 'jQuery',
          },
          {
            loader: 'expose-loader',
            query: '$',
          },
        ],
      },
    ];

    config.optimization = {
      nodeEnv: 'production',
      moduleIds: 'hashed',
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
        ? [
            new TerserPlugin({ cache: false, parallel: false, sourceMap: false, exclude: /monaco/ }),
            new OptimizeCSSAssetsPlugin({}),
          ]
        : [],
    };

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
