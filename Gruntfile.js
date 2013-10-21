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
    less: {
      // this is the only task, other than copy, that runs on the src directory, since we don't really need
      // the less files in the dist. Everything else runs from on temp, and require copys everything
      // from temp -> dist
      dist:{
        expand: true,
        cwd:'<%= srcDir %>/vendor/bootstrap/less/',
        src: ['bootstrap.dark.less', 'bootstrap.light.less'],
        dest: '<%= tempDir %>/css/',
      },
      // Compile in place when not building
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
    copy: {
      // copy source to temp, we will minify in place for the dist build
      everything_but_less_to_temp: {
        cwd: '<%= srcDir %>',
        expand: true,
        src: ['**/*', '!**/*.less'],
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
    htmlmin:{
      build: {
        options:{
          removeComments: true,
          collapseWhitespace: true
        },
        expand: true,
        cwd: '<%= tempDir %>',
        src: [
          'index.html',
          'app/panels/**/*.html',
          'app/partials/**/*.html'
        ],
        dest: '<%= tempDir %>'
      }
    },
    cssmin: {
      build: {
        expand: true,
        cwd: '<%= tempDir %>',
        src: '**/*.css',
        dest: '<%= tempDir %>'
      }
    },
    ngmin: {
      build: {
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
      build: {
        options: {
          appDir: '<%= tempDir %>',
          dir: '<%= destDir %>',

          mainConfigFile: '<%= tempDir %>/app/components/require.config.js',
          modules: [], // populated below

          optimize: 'none',
          optimizeCss: 'none',
          optimizeAllPluginResources: false,

          removeCombined: true,
          findNestedDependencies: true,
          normalizeDirDefines: 'all',
          inlineText: true,
          skipPragmas: true,

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
    compress: {
      zip: {
        options: {
          archive: '<%= tempDir %>/<%= pkg.name %>-latest.zip'
        },
        files : [
          {
            expand: true,
            cwd: '<%= destDir %>',
            src: ['**/*'],
            dest: '<%= pkg.name %>-latest'
          },
          {
            expand: true,
            src: ['LICENSE.md', 'README.md'],
            dest: '<%= pkg.name %>-latest'
          }
        ]
      },
      tgz: {
        options: {
          archive: '<%= tempDir %>/<%= pkg.name %>-latest.tar.gz'
        },
        files : [
          {
            expand: true,
            cwd: '<%= destDir %>',
            src: ['**/*'],
            dest: '<%= pkg.name %>-latest'
          },
          {
            expand: true,
            src: ['LICENSE.md', 'README.md'],
            dest: '<%= pkg.name %>-latest'
          }
        ]
      },
      zip_release: {
        options: {
          archive: '<%= tempDir %>/<%= pkg.name %>-<%= pkg.version %>.zip'
        },
        files : [
          {
            expand: true,
            cwd: '<%= destDir %>',
            src: ['**/*'],
            dest: '<%= pkg.name %>-<%= pkg.version %>'
          },
          {
            expand: true,
            src: ['LICENSE.md', 'README.md'],
            dest: '<%= pkg.name %>-<%= pkg.version %>'
          }
        ]
      },
      tgz_release: {
        options: {
          archive: '<%= tempDir %>/<%= pkg.name %>-<%= pkg.version %>.tar.gz'
        },
        files : [
          {
            expand: true,
            cwd: '<%= destDir %>',
            src: ['**/*'],
            dest: '<%= pkg.name %>-<%= pkg.version %>'
          },
          {
            expand: true,
            src: ['LICENSE.md', 'README.md'],
            dest: '<%= pkg.name %>-<%= pkg.version %>'
          }
        ]
      }
    },
    s3: {
      dist: {
        bucket: 'download.elasticsearch.org',
        access: 'private',
        // debug: true, // uncommment to prevent actual upload
        upload: [
          {
            src: '<%= tempDir %>/<%= pkg.name %>-latest.zip',
            dest: 'kibana/kibana/<%= pkg.name %>-latest.zip',
          },
          {
            src: '<%= tempDir %>/<%= pkg.name %>-latest.tar.gz',
            dest: 'kibana/kibana/<%= pkg.name %>-latest.tar.gz',
          }
        ]
      },
      release: {
        bucket: 'download.elasticsearch.org',
        access: 'private',
        // debug: true, // uncommment to prevent actual upload
        upload: [
          {
            src: '<%= tempDir %>/<%= pkg.name %>-<%= pkg.version %>.zip',
            dest: 'kibana/kibana/<%= pkg.name %>-<%= pkg.version %>.zip',
          },
          {
            src: '<%= tempDir %>/<%= pkg.name %>-<%= pkg.version %>.tar.gz',
            dest: 'kibana/kibana/<%= pkg.name %>-<%= pkg.version %>.tar.gz',
          }
        ]
      }
    }
  };

  // setup the modules require will build
  var requireModules = config.requirejs.build.options.modules = [
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
        'angular-sanitize',
        'angular-dragdrop'
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
    'less:dist',
    'copy:everything_but_less_to_temp',
    'htmlmin:build',
    'cssmin:build',
    'ngmin:build',
    'requirejs:build',
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
    'compress:zip',
    'compress:tgz',
    's3:dist',
    'clean:temp'
  ]);

  // build, then zip and upload to s3
  grunt.registerTask('release', [
    'distribute:load_s3_config',
    'build',
    'compress:zip_release',
    'compress:tgz_release',
    's3:release',
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
  grunt.loadNpmTasks('grunt-contrib-compress');


  // pass the config to grunt
  grunt.initConfig(config);

};