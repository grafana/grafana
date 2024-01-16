module.exports = function () {
  'use strict';
  return {
    txt: {
      expand: true,
      cwd: 'dist',
      src: ['**.txt'],
      dest: '../public/emails/',
    },
    html: {
      expand: true,
      cwd: 'dist',
      src: ['**.html'],
      dest: '../public/emails/',
    },
  };
};
