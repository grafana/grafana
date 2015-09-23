module.exports = function(config) {
  'use strict';

  config.set({
    basePath: __dirname + '/public_gen',

    frameworks: ['mocha', 'requirejs', 'expect', 'sinon'],

    // list of files / patterns to load in the browser
    files: [
      'test/test-main.js',
      {pattern: 'app/**/*.js', included: false},
      {pattern: 'vendor/**/*.js', included: false},
      {pattern: 'test/**/*.js', included: false}
    ],

    // list of files to exclude
    exclude: [],

    reporters: ['dots'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['PhantomJS'],
    captureTimeout: 60000,
    singleRun: true,

  });

};
