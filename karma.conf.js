var webpack = require('webpack');
var path = require('path');

module.exports = function(config) {

  'use strict';

  config.set({
    frameworks: ['mocha', 'expect', 'sinon'],

    // list of files / patterns to load in the browser
    files: [
      'public/test/index.ts',
    ],

    preprocessors: {
      'public/test/index.ts': ['webpack', 'sourcemap'],
    },

    webpack: {
      devtool: 'inline-source-map',
      module: {
        loaders: [
          {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: [
              // { loader: 'babel-loader', options:  { "presets": "es2015" } },
              { loader: "awesome-typescript-loader" }
            ]
          },
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
          }
        ],
      },
      externals: {
        'react/addons': true,
        'react/lib/ExecutionEnvironment': true,
        'react/lib/ReactContext': true,
        'systemjs/dist/system.src': true,
      },
      node: {
        fs: 'empty'
      },
      resolve: {
        extensions: ['.ts', '.tsx', '.es6', '.js', '.json'],
        modules: [
          path.resolve('public'),
          path.resolve('node_modules')
        ],
      },
      plugins: [
        new webpack.SourceMapDevToolPlugin({
          filename: null, // if no value is provided the sourcemap is inlined
          test: /\.(ts|js)($|\?)/i // process .js and .ts files only
        })
      ]
    },

    // webpackServer: {
    //   noInfo: true, // please don't spam the console when running in karma!
    // },

    // list of files to exclude
    exclude: [],
    reporters: ['dots'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['PhantomJS'],
    captureTimeout: 20000,
    singleRun: true,
    // autoWatchBatchDelay: 1000,
    // browserNoActivityTimeout: 60000,
  });

};
