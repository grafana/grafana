const wp = require('@cypress/webpack-preprocessor');

const webpackOptions = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'esbuild-loader',
          options: {
            target: 'es2020',
            format: undefined,
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};

const options = {
  webpackOptions,
};

module.exports = wp(options);
