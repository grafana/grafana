module.exports = function(config) {
  return {
    source: {
      files: {
        src: ['Gruntfile.js', '<%= srcDir %>/app/**/*.js'],
      }
    },
    options: {
      jshintrc: true,
      reporter: require('jshint-stylish'),
      ignores: [
        'node_modules/*',
        'dist/*',
        'sample/*',
        '<%= srcDir %>/vendor/*',
        '<%= srcDir %>/app/dashboards/*'
      ]
    }
  };
};
