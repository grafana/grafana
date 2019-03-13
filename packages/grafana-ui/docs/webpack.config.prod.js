
'use strict';
const common = require('../../../scripts/webpack/webpack.common.js');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  ...common,
  devtool: 'cheap-module-source-map',
  mode: 'development',
  entry: {
    app: path.resolve(__dirname, 'index.tsx'),
  },
  output: {
    path: path.resolve(__dirname, './build/dist'),
    filename: '[name].[hash].js',
    publicPath: '/dist',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.svg'],
    alias: {},
    modules: [
      path.resolve(__dirname),
      path.resolve('node_modules'),
      path.resolve('../../node_modules'),
      path.resolve('../../public/sass'),
    ],
  },
  module: {
    rules: [
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
      {
        test: /\.tsx?$/,
        enforce: 'pre',
        exclude: /node_modules/,
        use: {
          loader: 'tslint-loader',
          options: {
            emitErrors: true,
            typeCheck: false,
          },
        },
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
      },
      require('../../../scripts/webpack/sass.rule.js')({
        sourceMap: true,
        minimize: false,
        preserveUrl: false,
        lazy: true,
      }),
    ],
  },
  plugins: [
    new CopyPlugin([
      { from: path.resolve(__dirname,'./public/fonts'), to: path.resolve(__dirname,'./build/fonts') },
      { from: path.resolve(__dirname,'./public/img/'), to: path.resolve(__dirname,'./build/img') },
    ]),
    new HtmlWebpackPlugin({
      filename: path.resolve(__dirname, './build/index.html'),
      template: path.resolve(__dirname, './index.html'),
      inject: true,
      base:'dist'
    }),
    new ForkTsCheckerWebpackPlugin({
      checkSyntacticErrors: true,
      tsconfig: path.resolve(__dirname, '../tsconfig.json'),
    }),
  ],
};
