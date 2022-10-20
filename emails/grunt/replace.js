module.exports = {
  dist: {
    overwrite: false,
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
    dest: '../public/emails/',
  },
};
