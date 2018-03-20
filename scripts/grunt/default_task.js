// Lint and build CSS
module.exports = function(grunt) {
  'use strict';

  grunt.registerTask('default', [
    'clean:build',
    'phantomjs',
    'webpack:dev',
  ]);

  grunt.registerTask('test', [
    'jscs',
    'jshint',
    'sasslint',
    'exec:tslint',
    "exec:jest",
    'karma:test',
    'no-only-tests'
  ]);

  grunt.registerTask('precommit', [
    'jscs',
    'jshint',
    'sasslint',
    'exec:tslint',
    'no-only-tests'
  ]);

  grunt.registerTask('no-only-tests', function() {
    var files = grunt.file.expand('public/**/*_specs\.ts', 'public/**/*_specs\.js');

    files.forEach(function(spec) {
      var rows = grunt.file.read(spec).split('\n');
      rows.forEach(function(row) {
        if (row.indexOf('.only(') > 0) {
          grunt.log.errorlns(row);
          grunt.fail.warn('found only statement in test: ' + spec)
        }
      });
    });
  });
};
