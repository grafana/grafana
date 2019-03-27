const path = require('path');

module.exports = ({config, mode}) => {
  config.module.rules.push({
    test: /\.(ts|tsx)$/,
    use: [
      {
        loader: require.resolve('awesome-typescript-loader'),
        options: {
          configFileName: path.resolve(__dirname+'/../tsconfig.json')
        }
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
          // url: false,
          // sourceMap: false,
          // minimize: false,
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
