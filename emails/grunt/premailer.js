module.exports = {
  main: {
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
};
