/* jshint node:true */
'use strict';
module.exports = function (grunt) {

  var config = {
    pkg: grunt.file.readJSON('package.json'),
    srcDir: 'src',
    destDir: 'dist',
    tempDir: 'tmp',
    meta: {
      banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? " * " + pkg.homepage + "\\n" : "" %>' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= pkg.license %> */\n\n'
    },
    clean: {
      on_start: ['<%= destDir %>', '<%= tempDir %>'],
      after_require: ['<%= tempDir %>'],
    },
    copy: {
      everthing_left_in_src: {
        cwd: '<%= srcDir %>',
        expand: true,
        src: [
          '**/*.js',
          '**/*.json',
          'font/**/*',
          'img/**/*',
          'panels/bettermap/leaflet/*.png'
        ],
        dest: '<%= tempDir %>'
      }//,
      // dist_to_temp: {
      //   cwd: '<%= destDir %>',
      //   expand: true,
      //   src: '**/*',
      //   dest: '<%= tempDir %>'
      // }
    },
    jshint: {
      // just lint the source dir
      source: {
        files: {
          src: ['Gruntfile.js', '<%= srcDir %>/app/**/*.js']
        }
      },
      options: {
        jshintrc: '.jshintrc'
      }
    },
    less: {
      dist:{
        options:{
          compress: true
        },
        expand: true,
        cwd:'<%= srcDir %>/vendor/bootstrap/less/',
        src: ['bootstrap.dark.less', 'bootstrap.light.less'],
        dest: '<%= tempDir %>/css/',
      }
    },
    cssmin: {
      dist: {
        expand: true,
        cwd: '<%= srcDir %>',
        src: [
          '**/*.css'
        ],
        dest: '<%= tempDir %>'
      }
    },
    htmlmin:{
      dist: {
        options:{
          removeComments: true,
          collapseWhitespace: true
        },
        expand: true,
        cwd: '<%= srcDir %>',
        src: [
          'index.html',
          'app/panels/**/*.html',
          'app/partials/**/*.html'
        ],
        dest: '<%= tempDir %>'
      }
    },
    ngmin: {
      scripts: {
        expand:true,
        cwd:'<%= tempDir %>',
        src: [
          'app/controllers/**/*.js',
          'app/directives/**/*.js',
          'app/services/**/*.js',
          'app/filters/**/*.js',
          'app/panels/**/*.js',
          'app/app.js',
          'vendor/angular/**/*.js',
          'vendor/elasticjs/elastic-angular-client.js'
        ],
        dest: '<%= tempDir %>'
      }
    },
    requirejs: {
      compile_temp: {
        options: {
          appDir: '<%= tempDir %>',
          dir: '<%= destDir %>',
          modules: [], // populated below
          mainConfigFile: '<%= tempDir %>/app/components/require.config.js',
          keepBuildDir: true,
          optimize: 'uglify',
          optimizeCss: 'none',
          uglify: {
            max_line_length: 1000,
            // beautify: true, // uncomment for easier debugging
            indent_level: 2,
          },
          preserveLicenseComments: false,
          findNestedDependencies: true,
          normalizeDirDefines: "none",
          inlineText: true,
          skipPragmas: true,
          // stubModules: ["text"],
          optimizeAllPluginResources: false,
          removeCombined: true,
          fileExclusionRegExp: /^\./,
          logLevel: 0,
          skipSemiColonInsertion: true,
          done: function (done, output) {
            var duplicates = require('rjs-build-analysis').duplicates(output);

            if (duplicates.length > 0) {
              grunt.log.subhead('Duplicates found in requirejs build:');
              grunt.log.warn(duplicates);
              done(new Error('r.js built duplicate modules, please check the excludes option.'));
            }

            done();
          },
          config: {
            'tmpl': {
              registerTemplate: function () {}
            }
          }
        }
      }
    }
  };

  var fs = require('fs');
  var requireModules = [
    {
      // main/common module
      name: 'app',
      include: [
        'kbn',
        'jquery',
        'underscore',
        'angular',
        'bootstrap',
        'modernizr',
        'jquery',
        'angular-sanitize',
        'timepicker',
        'datepicker',
        'elasticjs',
        'angular-strap',
        'directives/all',
        'filters/all',
        'services/all',
        'jquery.flot',
        'jquery.flot.pie',
        'text'
      ]
    }
  ];

  // create a module for each directory in src/app/panels/
  fs.readdirSync(config.srcDir+'/app/panels').forEach(function (panelName) {
    requireModules.push({
      name: 'panels/'+panelName+'/module',
      exclude: ['app']
    });
  });

  config.requirejs.compile_temp.options.modules = requireModules;

  // load plugins
  grunt.loadNpmTasks('grunt-ngmin');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-requirejs');

  // Project configuration.
  grunt.initConfig(config);

  // Default task.
  grunt.registerTask('default', ['jshint:source','less']);
  grunt.registerTask('build', [
    'jshint:source',
    'clean:on_start',
    'htmlmin',
    'less',
    'cssmin',
    'copy:everthing_left_in_src',
    'ngmin',
    'requirejs:compile_temp',
    'clean:after_require'
  ]);

};