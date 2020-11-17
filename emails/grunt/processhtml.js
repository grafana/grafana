module.exports = {
  dist: {
    files: [
      {
        expand: true, // Enable dynamic expansion.
        cwd: 'dist', // Src matches are relative to this path.
        src: ['*.html'], // Actual pattern(s) to match.
        dest: 'dist/', // Destination path prefix.
      },
    ],
  },
};
