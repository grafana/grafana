/* jshint node:true */
'use strict';
module.exports = function (grunt) {

  var config = {
    pkg: grunt.file.readJSON('package.json'),
    baseDir: '.',
    srcDir: 'src',
    destDir: 'dist',
    tempDir: 'tmp',
    docsDir: 'docs/'
  };

  config.mode = grunt.option('mode') || 'backend';
  config.modeOptions = {
    zipSuffix: '',
    requirejs: {
      paths: { config: '../config.sample' },
      excludeConfig: true,
    }
  };

  if (config.mode === 'backend') {
    grunt.log.writeln('Setting backend build mode');
    config.modeOptions.zipSuffix = '-backend';
    config.modeOptions.requirejs.paths = {};
    config.modeOptions.requirejs.excludeConfig = false;
  }

  // load plugins
  require('load-grunt-tasks')(grunt);

  // load task definitions
  grunt.loadTasks('tasks');

  // Utility function to load plugin settings into config
  function loadConfig(config,path) {
    require('glob').sync('*', {cwd: path}).forEach(function(option) {
      var key = option.replace(/\.js$/,'');
      // If key already exists, extend it. It is your responsibility to avoid naming collisions
      config[key] = config[key] || {};
      grunt.util._.extend(config[key], require(path + option)(config,grunt));
    });
    // technically not required
    return config;
  }

  // Merge that object with what with whatever we have here
  loadConfig(config,'./tasks/options/');

  // pass the config to grunt
  grunt.initConfig(config);
};
