module.exports = {
  src: {
    files: [
      //what are the files that we want to watch
      'templates/**/*.txt',
      'grunt/*.js',
    ],
    tasks: ['default'],
    options: {
      nospawn: true,
      livereload: false,
    },
  },
};
