
module.exports = function(grunt) {
  "use strict";

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'clean:release',
    'clean:build',
    'exec:webpack',
  ]);

};
