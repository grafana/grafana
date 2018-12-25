module.exports = function(config) {
  'use strict';
  return {
    options: {
      configFile: 'public/sass/.sass-lint.yml',
    },
    // src: ['public/sass#<{(||)}>#*'],
    target: [
      'public/sass/*.scss',
      'public/sass/components/*.scss',
    ]
  };
};
