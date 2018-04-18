var path = require('path');

module.exports = function(grunt) {
  "use strict";

  // build, then zip and upload to s3
  grunt.registerTask('release', [
    'build',
    'build-post-process',
    'compress:release'
  ]);

  // build, prepare zip
  // don't copy any binaries
  // don't zip
  grunt.registerTask('prerelease', [
    'build',
    'build-post-process-without-bin',
  ]);

  grunt.registerTask('build-post-process', [
    'build-post-process-without-bin',
    'build-post-process-bin-only',
    'build-post-process-phantomjs'
  ]);

  grunt.registerTask('build-post-process-without-bin', function() {
    grunt.config('copy.public_to_temp', {
      expand: true,
      cwd: '<%= srcDir %>',
      src: '**/*',
      dest: '<%= tempDir %>/public/',
    });
    grunt.config('copy.backend_files', {
      expand: true,
      src: ['conf/**', 'tools/phantomjs/render.js', 'scripts/*'],
      options: { mode: true},
      dest: '<%= tempDir %>'
    });

    grunt.task.run('copy:public_to_temp');
    grunt.task.run('copy:backend_files');
    //seems to do nothing, in doubt ...
    grunt.task.run('clean:packaging');

    grunt.file.write(path.join(grunt.config('tempDir'), 'VERSION'), grunt.config('pkg.version'));
  });

  grunt.registerTask('build-post-process-phantomjs', function() {
    grunt.config('copy.backend_phantomjs_bin', {
      expand: true,
      src: ['conf/**', 'tools/phantomjs/phantomjs.js', 'scripts/*'],
      options: { mode: true},
      dest: '<%= tempDir %>'
    });

    grunt.task.run('copy:backend_phantomjs_bin');
  });

  grunt.registerTask('build-post-process-bin-only', function() {
    grunt.config('copy.backend_bin', {
      cwd: 'bin',
      expand: true,
      src: ['*'],
      options: { mode: true},
      dest: '<%= tempDir %>/bin/'
    });

    grunt.task.run('copy:backend_bin');
  });

};
