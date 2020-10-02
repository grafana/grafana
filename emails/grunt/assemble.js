module.exports = function() {
  'use strict';
  return {
    options: {
      layout: 'templates/layouts/default.html',
      partials: ['templates/partials/*.hbs'],
      helpers: ['templates/helpers/**/*.js'],
      data: [],
      flatten: true,
    },
    pages: {
      src: ['templates/*.html'],
      dest: 'dist/',
    },
  };
};
