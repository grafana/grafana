module.exports = function(config) {
  'use strict';
  return {
    options: {
      configFile: 'public/sass/.sass-lint.yml',
    },
    target: [
      'public/sass/*.scss',
      'public/sass/components/*.scss',
    ]
  };
};
