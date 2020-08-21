module.exports = function(config) {
  'use strict';
  return {
    options: {
      configFile: 'public/sass/.sass-lint.yml',
    },
    src: ['public/sass/**/*.scss', 'packages/**/*.scss', '!**/node_modules/**/*.scss'],
  };
};
