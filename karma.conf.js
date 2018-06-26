var webpack = require('webpack');
var path = require('path');
var webpackTestConfig = require('./scripts/webpack/webpack.test.js');

module.exports = function(config) {

  'use strict';

  config.set({
    frameworks: ['mocha', 'expect', 'sinon'],

    // list of files / patterns to load in the browser
    files: [
      { pattern: 'public/test/index.ts', watched: false }
    ],

    preprocessors: {
      'public/test/index.ts': ['webpack', 'sourcemap'],
    },

    webpack: webpackTestConfig,
    webpackMiddleware: {
      stats: 'minimal',
    },

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
