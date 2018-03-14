module.exports = function(grunt) {
  "use strict";

  function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }

  function extractColour(line) {
    var regex = /\s*:\s*(#[a-fA-F0-9]{3,6})\s*(!default|!default;)?/;
    var matches = line.match(regex);
    return matches ? matches[1] : matches;
  }

  function extractVariable(line) {
    var matches = line.match(/(\$[0-9a-zA-Z_-]+)\s*(!default|!default;)?/)
    return matches ? matches[1] : matches
  }

  function readVars(file, obj) {
    var content = grunt.file.read(file);
    var lines = content.split('\n');

    lines.forEach(function(line) {
      var variable = extractVariable(line);
      if (variable) {
        var color = extractColour(line, variable);
        if (color) {
          obj[variable] = color;
        }
      }
    });
  }

  grunt.registerTask('styleguide', function() {
    var data = {
      dark: {}, light: {}
    };

    readVars('public/sass/_variables.dark.scss', data.dark);
    readVars('public/sass/_variables.light.scss', data.light);

    var styleGuideJson = grunt.config().srcDir + '/build/styleguide.json';
    grunt.file.write(styleGuideJson, JSON.stringify(data, null, 4));

  });

};
