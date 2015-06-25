module.exports = function(config) {
  'use strict';

  config.set({
    basePath: '../../',

    frameworks: ['mocha', 'requirejs', 'expect', 'sinon'],

    // list of files / patterns to load in the browser
    files: [
      'public/test/test-main.js',
      {pattern: 'public/app/**/*.js', included: false},
      {pattern: 'public/app/**/*.html', included: false},
      {pattern: 'public/vendor/**/*.js', included: false},
      {pattern: 'public/test/**/*.js', included: false},
      {pattern: 'public/**/*.js', included: false}
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
