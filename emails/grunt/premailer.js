module.exports = {
  html: {
    options: {
      verbose: true,
      removeComments: true,
    },
    files: [
      {
        expand: true, // Enable dynamic expansion.
        cwd: 'dist', // Src matches are relative to this path.
        src: ['*.html'], // Actual pattern(s) to match.
        dest: '../public/emails/', // Destination path prefix.
      },
    ],
  },
  txt: {
    options: {
      verbose: true,
      mode: 'txt',
      lineLength: 90,
    },
    files: [
      {
        expand: true, // Enable dynamic expansion.
        cwd: 'dist', // Src matches are relative to this path.
        src: ['*.txt'], // Actual patterns to match.
        dest: '../public/emails/', // Destination path prefix.
      },
    ],
  },
};
