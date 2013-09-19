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
      temp: ['<%= tempDir %>'],
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
      }
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
      },
      // Compile to src when not building
      src:{
        options: {
          paths: ["<%= srcDir %>/vendor/bootstrap/less"],
          yuicompress:true
        },
        files: {
          "<%= srcDir %>/css/bootstrap.dark.min.css": "<%= srcDir %>/vendor/bootstrap/less/bootstrap.dark.less",
          "<%= srcDir %>/css/bootstrap.light.min.css": "<%= srcDir %>/vendor/bootstrap/less/bootstrap.light.less"
        }
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

          mainConfigFile: '<%= tempDir %>/app/components/require.config.js',
          modules: [], // populated below

          optimize: 'none',
          optimizeCss: 'none',

          removeCombined: true,
          preserveLicenseComments: false,
          findNestedDependencies: true,
          normalizeDirDefines: "none",
          inlineText: true,
          skipPragmas: true,
          optimizeAllPluginResources: false,

          done: function (done, output) {
            var duplicates = require('rjs-build-analysis').duplicates(output);

            if (duplicates.length > 0) {
              grunt.log.subhead('Duplicates found in requirejs build:');
              grunt.log.warn(duplicates);
              done(new Error('r.js built duplicate modules, please check the excludes option.'));
            }

            done();
          }
        }
      }
    },
    uglify: {
      dest: {
        expand: true,
        src: ['**/*.js', '!config.js', '!app/dashboards/*.js'],
        dest: '<%= destDir %>',
        cwd: '<%= destDir %>',
        options: {
          quite: true,
          compress: true,
          preserveComments: false,
          banner: '<%= meta.banner %>'
        }
      }
    },
    'git-describe': {
      me: {
        // Target-specific file lists and/or options go here.
      },
    },
    zip: {
      dist: {
        cwd: '<%= destDir %>',
        src: ['<%= destDir %>/**/*','LICENSE.md','README.md'],
        dest: '<%= tempDir %>/dist.zip'
      }
    },
    s3: {
      dist: {
        bucket: 'download.elasticsearch.org',
        access: 'private',
        // debug: true, // uncommment to prevent actual upload
        upload: [
          {
            src: '<%= tempDir %>/dist.zip',
            dest: 'kibana/kibana/<%= pkg.name %>-latest.zip',
          }
        ]
      }
    }
  };

  // setup the modules require will build
  var requireModules = config.requirejs.compile_temp.options.modules = [
    {
      // main/common module
      name: 'app',
      include: [
        'css',
        'kbn',
        'text',
        'jquery',
        'angular',
        'settings',
        'bootstrap',
        'modernizr',
        'elasticjs',
        'timepicker',
        'datepicker',
        'underscore',
        'filters/all',
        'jquery.flot',
        'services/all',
        'angular-strap',
        'directives/all',
        'jquery.flot.pie',
        'angular-sanitize'
      ]
    }
  ];

  // create a module for each directory in src/app/panels/
  require('fs')
    .readdirSync(config.srcDir+'/app/panels')
    .forEach(function (panelName) {
      requireModules.push({
        name: 'panels/'+panelName+'/module',
        exclude: ['app']
      });
    });

  // exclude the literal config definition from all modules
  requireModules
    .forEach(function (module) {
      module.excludeShallow = module.excludeShallow || [];
      module.excludeShallow.push('config');
    });

  // Run jshint
  grunt.registerTask('default', ['jshint:source', 'less:src']);

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'jshint:source',
    'clean:on_start',
    'htmlmin',
    'less:dist',
    'cssmin',
    'copy:everthing_left_in_src',
    'ngmin',
    'requirejs:compile_temp',
    'clean:temp',
    'build:write_revision',
    'uglify:dest'
  ]);

  // run a string replacement on the require config, using the latest revision number as the cache buster
  grunt.registerTask('build:write_revision', function() {
    grunt.event.once('git-describe', function (desc) {
      grunt.config('string-replace.config', {
        src: '<%= destDir %>/app/components/require.config.js',
        dest: '<%= destDir %>/app/components/require.config.js',
        options: {
          replacements: [
            {
              pattern: /(?:^|\/\/)(.*)@REV@/,
              replacement: '$1'+desc.object
            }
          ]
        }
      });

      grunt.task.run('string-replace:config');
    });
    grunt.task.run('git-describe');
  });

  // build, then zip and upload to s3
  grunt.registerTask('distribute', [
    'distribute:load_s3_config',
    'build',
    'zip:dist',
    's3:dist',
    'clean:temp'
  ]);

  // collect the key and secret from the .aws-config.json file, finish configuring the s3 task
  grunt.registerTask('distribute:load_s3_config', function () {
    var config = grunt.file.readJSON('.aws-config.json');
    grunt.config('s3.options', {
      key: config.key,
      secret: config.secret
    });
  });

  // load plugins
  grunt.loadNpmTasks('grunt-s3');
  grunt.loadNpmTasks('grunt-zip');
  grunt.loadNpmTasks('grunt-ngmin');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-git-describe');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-string-replace');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-requirejs');

  // pass the config to grunt
  grunt.initConfig(config);

};