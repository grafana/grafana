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
      { loader: 'sass-loader', options: { sourceMap: false } },
    ],
  });
  config.module.rules.push({
    test: /\.(png|jpg|gif|ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
    loader: 'file-loader',
  });
  config.resolve.extensions.push('.ts', '.tsx');
  return config;
};
