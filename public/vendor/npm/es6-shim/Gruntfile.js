'use strict';

module.exports = function (grunt) {
  var browsers = [
    { browserName: 'firefox', version: '19', platform: 'XP' },
    { browserName: 'firefox', platform: 'linux' },
    { browserName: 'firefox', platform: 'OS X 10.10' },
    { browserName: 'chrome', platform: 'linux' },
    { browserName: 'chrome', platform: 'OS X 10.9' },
    { browserName: 'chrome', platform: 'XP' },
    { browserName: 'internet explorer', platform: 'Windows 8.1', version: '11' },
    { browserName: 'internet explorer', platform: 'WIN8', version: '10' },
    { browserName: 'internet explorer', platform: 'VISTA', version: '9' },
    { browserName: 'safari', platform: 'OS X 10.6' },
    { browserName: 'safari', platform: 'OS X 10.8' },
    { browserName: 'safari', platform: 'OS X 10.9' },
    { browserName: 'safari', platform: 'OS X 10.10' },
    { browserName: 'iphone', platform: 'OS X 10.9', version: '7.1' },
    { browserName: 'android', platform: 'Linux', version: '4.4' },
  ];
  var extraBrowsers = [
    { browserName: 'firefox', platform: 'linux', version: '30' },
    { browserName: 'firefox', platform: 'linux', version: '25' },
    { browserName: 'iphone', platform: 'OS X 10.8', version: '6.1' },
    { browserName: 'iphone', platform: 'OS X 10.8', version: '5.1' },
    { browserName: 'android', platform: 'Linux', version: '4.2' },
    // XXX haven't investigated these:
    // { browserName: 'opera', platform: 'Windows 7', version: '12' },
    // { browserName: 'opera', platform: 'Windows 2008', version: '12' }
    // { browserName: 'iphone', platform: 'OS X 10.6', version: '4.3' },
    // { browserName: 'android', platform: 'Linux', version: '4.0' },
  ];
  if (grunt.option('extra')) {
      browsers = browsers.concat(extraBrowsers);
  }
  grunt.initConfig({
    connect: {
      server: {
        options: {
          base: '',
          port: 9999,
          useAvailablePort: true
        }
      }
    },
    'saucelabs-mocha': {
      all: {
        options: {
          urls: (function () {
            var urls = ['http://localhost:9999/test/'];
            if (grunt.option('extra')) {
              urls.push('http://localhost:9999/test-sham/');
            }
            return urls;
          }()),
          // tunnelTimeout: 5,
          build: process.env.TRAVIS_BUILD_NUMBER,
          tunneled: !process.env.SAUCE_HAS_TUNNEL,
          identifier: process.env.TRAVIS_JOB_NUMBER,
          sauceConfig: {
            'tunnel-identifier': process.env.TRAVIS_JOB_NUMBER
          },
          // concurrency: 3,
          browsers: browsers,
          testname: (function () {
            var testname = 'mocha';
            if (process.env.TRAVIS_PULL_REQUEST && process.env.TRAVIS_PULL_REQUEST !== 'false') {
              testname += ' (PR ' + process.env.TRAVIS_PULL_REQUEST + ')';
            }
            if (process.env.TRAVIS_BRANCH && process.env.TRAVIS_BRANCH !== 'false') {
              testname += ' (branch ' + process.env.TRAVIS_BRANCH + ')';
            }
            return testname;
          }()),
          tags: (function () {
            var tags = [];
            if (process.env.TRAVIS_PULL_REQUEST && process.env.TRAVIS_PULL_REQUEST !== 'false') {
              tags.push('PR-' + process.env.TRAVIS_PULL_REQUEST);
            }
            if (process.env.TRAVIS_BRANCH && process.env.TRAVIS_BRANCH !== 'false') {
              tags.push(process.env.TRAVIS_BRANCH);
            }
            return tags;
          }())
        }
      }
    },
    watch: {}
  });
  // Loading dependencies
  for (var key in grunt.file.readJSON('package.json').devDependencies) {
    if (key !== 'grunt' && key.indexOf('grunt') === 0) {
      grunt.loadNpmTasks(key);
    }
  }
  grunt.registerTask('dev', ['connect', 'watch']);
  grunt.registerTask('sauce', ['connect', 'saucelabs-mocha']);
};
