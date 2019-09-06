const path = require('path');

module.exports = ({config, mode}) => {
  config.module.rules.push({
    test: /\.(ts|tsx)$/,
    use: [
      {
        loader: require.resolve('ts-loader'),
        options: {}
      },
    ],
  });

  config.module.rules.push({
    test: /\.scss$/,
    use: [
      {
        loader: 'style-loader/useable',
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

  return config;
};
