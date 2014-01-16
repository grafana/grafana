/* jshint node:true */
'use strict';
module.exports = function (grunt) {

  var config = {
    pkg: grunt.file.readJSON('package.json'),

    connect: {
      dev: {
        options: {
          port: 5603,
          base: '.',
          keepalive: true
        }
      },
    }
  };

  require('load-grunt-tasks')(grunt);
  grunt.loadTasks('tasks');

  grunt.registerTask('server', ['connect:dev']);


  grunt.initConfig(config);

};