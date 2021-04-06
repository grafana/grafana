module.exports = function () {
  'use strict';
  return {
    options: {
      partials: ['templates/partials/*.hbs'],
      helpers: ['templates/helpers/**/*.js'],
      data: [],
      flatten: true,
    },
    html: {
      options: {
        layout: 'templates/layouts/default.html',
      },
      src: ['templates/*.html'],
      dest: 'dist/',
    },
    txt: {
      options: {
        layout: 'templates/layouts/default.txt',
        ext: '.txt',
      },
      src: ['templates/*.txt'],
      dest: 'dist/',
    },
  };
};
