module.exports = {
  dist: {
    overwrite: true,
    src: ['dist/*.html', 'dist/*.txt'],
    replacements: [
      {
        from: '[[',
        to: '{{',
      },
      {
        from: ']]',
        to: '}}',
      },
    ],
  },
};
