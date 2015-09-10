module.exports = function(config) {
  'use strict';

  config.set({
    basePath: __dirname + '/public_gen',

    frameworks: ['mocha', 'requirejs', 'expect', 'sinon'],

    // list of files / patterns to load in the browser
    files: [
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386:karma.conf.js
      'test/test-main.js',
      {pattern: 'app/**/*.js', included: false},
      {pattern: 'vendor/**/*.js', included: false},
      {pattern: 'test/**/*.js', included: false}
=======
      'public/test/test-main.js',
      {pattern: 'public/.app_gen/**/*.js', included: false},
      {pattern: 'public/vendor/**/*.js', included: false},
      {pattern: 'public/test/**/*.js', included: false},
      {pattern: 'public/**/*.js', included: false}
>>>>>>> tech(typescript): its looking good:public/test/karma.conf.js
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
