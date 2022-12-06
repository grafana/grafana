'use strict';

const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const { merge } = require('webpack-merge');

const HTMLWebpackCSSChunks = require('./plugins/HTMLWebpackCSSChunks');
const common = require('./webpack.common.js');

module.exports = (env = {}) =>
  merge(common, {
    mode: 'production',
    devtool: 'source-map',

    // entry: {
    //   dark: '../sass/grafana.dark.scss',
    //   light: '../sass/grafana.light.scss',
    // },

    module: {
      // Note: order is bottom-to-top and/or right-to-left
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                rootMode: 'upward',
                cacheDirectory: true,
                cacheCompression: false,
              },
            },
          ],
        },
        require('./sass.rule.js')({
          sourceMap: false,
          preserveUrl: false,
        }),
      ],
    },
    optimization: {
      nodeEnv: 'production',
      minimize: parseInt(env.noMinify, 10) !== 1,
      minimizer: [
        new TerserPlugin({
          parallel: false,
        }),
        new CssMinimizerPlugin(),
      ],
    },

    // enable persistent cache for faster builds
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '../../../.yarn/.cache/webpack'),
      name: 'grafana-default-production',
      buildDependencies: {
        config: [__filename],
      },
    },

    plugins: [
      new MiniCssExtractPlugin({
        filename: 'grafana.[name].[contenthash].css',
      }),
      new HtmlWebpackPlugin({
        filename: path.resolve(__dirname, '../../views/error.html'),
        template: path.resolve(__dirname, '../../views/error-template.html'),
        inject: false,
        excludeChunks: ['dark', 'light'],
        chunksSortMode: 'none',
      }),
      new HtmlWebpackPlugin({
        filename: path.resolve(__dirname, '../../views/index.html'),
        template: path.resolve(__dirname, '../../views/index-template.html'),
        inject: false,
        excludeChunks: ['manifest', 'dark', 'light'],
        chunksSortMode: 'none',
      }),
      new HTMLWebpackCSSChunks(),
      new WebpackManifestPlugin({
        // fileName: path.join(__dirname, '../../../manifest.json'),
        fileName: path.join(process.cwd(), 'manifest.json'),
        filter: (file) => !file.name.endsWith('.map'),
      }),
      function () {
        this.hooks.done.tap('Done', function (stats) {
          if (stats.compilation.errors && stats.compilation.errors.length) {
            console.log(stats.compilation.errors);
            process.exit(1);
          }
        });
      },
    ],
  });
