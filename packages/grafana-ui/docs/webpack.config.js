'use strict';
const common = require('../../../scripts/webpack/webpack.common.js');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CleanWebpackPlugin = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

// console.log(__dirname)
module.exports = {
  ...common,
  devtool: "cheap-module-source-map",
  mode: 'development',
  entry: {
    app: path.resolve(__dirname, 'index.tsx'),
  },
  output: {
    path: path.resolve(__dirname, './public'),
    filename: '[name].[hash].js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.svg'],
    alias: {
    },
    modules: [
      path.resolve(__dirname),
      path.resolve('node_modules'),
      path.resolve('../../node_modules'),
      path.resolve('../../public/sass'),

    ],
  },
  devServer: {
    contentBase: path.resolve(process.cwd(), 'public/'),
    disableHostCheck: true,
    port: 9000,
    historyApiFallback: true,
  },
  module: {
    rules: [
      {
        test: require.resolve('jquery'),
        use: [
          {
            loader: 'expose-loader',
            query: 'jQuery'
          },
          {
            loader: 'expose-loader',
            query: '$'
          }
        ]
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
          }
        }
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true
          },
        },
      },
      require('../../../scripts/webpack/sass.rule.js')({ sourceMap: false, minimize: false, preserveUrl: false }),
      {
        test: /\.(png|jpg|gif|ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
        loader: 'file-loader'
      },
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
      inject: true
    }),
    new MiniCssExtractPlugin({
      filename: "grafana.[name].[hash].css"
    }),
  ]
}
