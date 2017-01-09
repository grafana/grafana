module.exports = function(config) {
  'use strict';

  config.set({
    basePath: __dirname + '/public_gen',

    frameworks: ['mocha', 'expect', 'sinon'],

    // list of files / patterns to load in the browser
    files: [
      'vendor/npm/es6-shim/es6-shim.js',
      'vendor/npm/systemjs/dist/system.src.js',
      'test/test-main.js',

      {pattern: '**/*.js', included: false},
    ],

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
    autoWatchBatchDelay: 1000,
    browserNoActivityTimeout: 60000,

  });

};
