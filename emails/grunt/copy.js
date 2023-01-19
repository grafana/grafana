module.exports = function () {
  'use strict';
  return {
    txt: {
      expand: true,
      cwd: 'dist',
      src: ['**.txt'],
      dest: '../public/emails/',
    },
  };
};
