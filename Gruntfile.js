'use strict';

module.exports = function (grunt) {

  var post = ['src/client.js','src/post.js'];

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? " * " + pkg.homepage + "\\n" : "" %>' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= pkg.license %> */\n\n'
    },
    jshint: {
      files: ['Gruntfile.js', 'js/*.js', 'panels/*/*.js' ],
      options: {
        bitwise: true,
        maxlen: 140,
        curly: true,
        eqeqeq: true,
        immed: true,
        indent: 2,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        globalstrict: true,
        devel: true,
        node: true,
        globals: {
          '$LAB': false,
          '_': false,
          '$': false,
          'kbn' : false,
          window: false,
          document: false,
          exports: true,
          module: false,
          config: false,
          moment: false
        }
      }
    },
    less: {
      production: {
        options: {
          paths: ["vendor/bootstrap/less"],
          yuicompress:true
        },
        files: {
          "common/css/bootstrap.dark.min.css": "vendor/bootstrap/less/bootstrap.dark.less",
          "common/css/bootstrap.light.min.css": "vendor/bootstrap/less/bootstrap.light.less"
        }
      }
    }
  });

  // load plugins
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('assemble-less');



  // Default task.
  grunt.registerTask('default', ['jshint','less']);

};
