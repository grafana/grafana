var path = require('path');

module.exports = function(grunt) {
  'use strict';

  // build then zip
  grunt.registerTask('release', ['build', 'build-post-process', 'compress:release']);

  // package into archives
  grunt.registerTask('package', ['clean:temp', 'build-post-process', 'compress:release']);

  grunt.registerTask('build-post-process', function() {
    grunt.config('copy.public_to_temp', {
      expand: true,
      cwd: '<%= srcDir %>',
      src: '**/*',
      dest: '<%= tempDir %>/public/',
    });
    grunt.config('copy.backend_bin', {
      cwd: 'bin/<%= platform %>-<%= arch %><%= libc ? "-" + libc : "" %>',
      expand: true,
      src: ['*'],
      options: { mode: true },
      dest: '<%= tempDir %>/bin/',
    });
    grunt.config('copy.backend_files', {
      expand: true,
      src: ['conf/**', 'tools/**', 'scripts/*'],
      options: { mode: true },
      dest: '<%= tempDir %>',
    });

    grunt.task.run('copy:public_to_temp');
    grunt.task.run('copy:backend_bin');
    grunt.task.run('copy:backend_files');
    grunt.task.run('clean:packaging');

    grunt.file.write(path.join(grunt.config('tempDir'), 'VERSION'), grunt.config('pkg.version'));
  });
};
