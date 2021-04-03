module.exports = {
  src: {
    files: [
      //what are the files that we want to watch
      'assets/css/*.css',
      'templates/**/*.html',
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
