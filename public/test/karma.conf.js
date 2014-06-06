module.exports = function(config) {
  'use strict';

  config.set({
    basePath: '../',

    frameworks: ['mocha', 'requirejs', 'expect'],

    // list of files / patterns to load in the browser
    files: [
      'test/test-main.js',
      {pattern: 'app/**/*.js', included: false},
      {pattern: 'vendor/**/*.js', included: false},
      {pattern: 'test/**/*.js', included: false},
      {pattern: '**/*.js', included: false}
    ],

    // list of files to exclude
    exclude: [],

    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    captureTimeout: 60000,
    singleRun: false
  });
};
