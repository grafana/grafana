module.exports = function () {
  'use strict';
  return {
    options: {
      data: [],
      flatten: true,
    },
    txt: {
      options: {
        layout: 'templates/partials/layout/default.txt',
        ext: '.txt',
      },
      src: ['templates/*.txt'],
      dest: 'dist/',
    },
  };
};
