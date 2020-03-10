const { resolve } = require('path');
const wp = require('@cypress/webpack-preprocessor');

const packageRoot = resolve(`${__dirname}/../../`);
const packageModules = `${packageRoot}/node_modules`;

const webpackOptions = {
  module: {
    rules: [
      {
        include: modulePath => {
          return modulePath.startsWith(packageRoot) && !modulePath.startsWith(packageModules);
        },
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: `${__dirname}/../tsconfig.json`,
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
