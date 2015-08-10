module.exports = {
	dist: {
    files: [{
      expand: true,     // Enable dynamic expansion.
      cwd: 'templates',      // Src matches are relative to this path.
      src: ['*.html'], // Actual pattern(s) to match.
      dest: 'dist/',   // Destination path prefix.
    }],
  }
};
