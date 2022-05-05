const wp = require('@cypress/webpack-preprocessor');
const { resolve } = require('path');

const anyNodeModules = /node_modules/;
const packageRoot = resolve(`${__dirname}/../../`);
const packageModules = `${packageRoot}/node_modules`;

const webpackOptions = {
  module: {
    rules: [
      {
        include: (modulePath) => {
          if (!anyNodeModules.test(modulePath)) {
            // Is a file within the project
            return true;
          } else {
            // Is a file within this package
            return modulePath.startsWith(packageRoot) && !modulePath.startsWith(packageModules);
          }
        },
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        ],
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
