const path = require('path');

module.exports = (baseConfig, env, config) => {
  config.module.rules.push({
    test: /\.(ts|tsx)$/,
    use: [
      {
        loader: require.resolve('awesome-typescript-loader'),
      },
    ],
  });

  config.module.rules.push({
    test: /\.scss$/,
    use: [
      {
        loader: 'style-loader',
      },
      {
        loader: 'css-loader',
        options: {
          importLoaders: 2,
          url: false,
          sourceMap: false,
          minimize: false,
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
          sourceMap: false
        },
      },
    ],
  });

  config.module.rules.push({
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
  });

  config.resolve.extensions.push('.ts', '.tsx');

  // Remove pure js loading rules as Storybook's Babel config is causing problems when mixing ES6 and CJS
  // More about the problem we encounter: https://github.com/webpack/webpack/issues/4039
  config.module.rules = config.module.rules.filter(rule => rule.test.toString() !== /\.(mjs|jsx?)$/.toString());
  return config;
};
