/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

module.exports = (grunt) => {

  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-execute');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('gruntify-eslint');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  const
    productionDest = 'dist',
    developmentDest = '../Projects/Go/src/github.com/grafana/grafana/data/plugins/adremsoft-netcrunch-app/';

  function createCleanTask(destination) {
    return [destination];
  }

  function createCopyTask(destination) {
    const excludeFiles = ['!**/*.js', '!**/*.ts', '!**/*.scss', '!license-banner.txt'];
    return {
      files: [
        {
          cwd: 'src',
          expand: true,
          src: ['**/*'].concat(excludeFiles),
          dest: destination
        },
        {
          cwd: 'src/datasource/services/netCrunchAPI/adrem',
          expand: true,
          src: ['*.min.js'],
          dest: `${destination}/datasource/services/netCrunchAPI/adrem`
        },
        {
          expand: true,
          src: ['README.md'],
          dest: destination
        }
      ]
    };
  }

  function createBabelTask(destination) {
    return {
      files: [{
        cwd: 'src',
        expand: true,
        src: ['**/*.js', '**/*.ts', '!**/*.min.js'],
        dest: destination,
        ext: '.js',
        extDot: 'last'
      }]
    };
  }

  function createUglifyTask(destination) {
    return {
      files: [{
        expand: true,
        cwd: destination,
        src: ['**/*.js', '!**/*.min.js'],
        dest: destination
      }]
    };
  }

  grunt.initConfig({

    clean: {
      options: { force: true },
      prod: createCleanTask(productionDest),
      dev: createCleanTask(developmentDest)
    },

    copy: {
      prod: createCopyTask(productionDest),
      dev: createCopyTask(developmentDest)
    },

    watch: {
      rebuild_all: {
        files: ['src/**/*', 'README.md'],
        tasks: ['develop'],
        options: { spawn: false }
      }
    },

    eslint: {
      options: {
        silent: true
      },
      src: ['src/**/*.js', '!**/*.min.js']
    },

    babel: {
      options: {
        sourceMap: true,
        presets: ['es2015', 'babili'],
        plugins: ['transform-es2015-modules-systemjs', 'transform-es2015-for-of']
      },
      prod: createBabelTask(productionDest),
      dev: createBabelTask(developmentDest)
    },

    uglify: {
      prod: createUglifyTask(productionDest),
      dev: createUglifyTask(developmentDest)
    }

  });

  grunt.registerTask('default', ['clean:prod', 'copy:prod', 'eslint', 'babel:prod']);
  grunt.registerTask('build', ['default']);
  grunt.registerTask('develop', ['clean:dev', 'copy:dev', 'babel:dev']);

};
