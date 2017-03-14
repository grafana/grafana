module.exports = {
	dist: {
    overwrite: true,
    src: ['dist/*.html'],
    replacements: [{
      from: '[[',
      to: '{{'
    }, {
      from: ']]',
      to:  '}}'
    }]
  }
};
