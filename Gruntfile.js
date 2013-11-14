/* jshint node:true */
'use strict';
module.exports = function (grunt) {

  var config = {
    pkg: grunt.file.readJSON('package.json'),
    srcDir: 'src',
    destDir: 'dist',
    tempDir: 'tmp',
  };

  // load plugins
  require('load-grunt-tasks')(grunt);

  // load task definitions
  grunt.loadTasks('tasks');

  // Utility function to load plugin configurations into an object
  function loadConfig(path) {
    var object = {};
    require('glob').sync('*', {cwd: path}).forEach(function(option) {
      object[option.replace(/\.js$/,'')] = require(path + option)(config);
    });
    return object;
  }

  // Merge that object with what with whatever we have here
  grunt.util._.extend(config, loadConfig('./tasks/options/'));

  // pass the config to grunt
  grunt.initConfig(config);

};