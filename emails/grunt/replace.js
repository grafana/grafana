module.exports = {
  dist: {
    overwrite: true,
    src: ['dist/*.txt'],
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
