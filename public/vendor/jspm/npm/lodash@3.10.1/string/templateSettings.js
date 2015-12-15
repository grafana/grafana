/* */ 
var escape = require('./escape'),
    reEscape = require('../internal/reEscape'),
    reEvaluate = require('../internal/reEvaluate'),
    reInterpolate = require('../internal/reInterpolate');
var templateSettings = {
  'escape': reEscape,
  'evaluate': reEvaluate,
  'interpolate': reInterpolate,
  'variable': '',
  'imports': {'_': {'escape': escape}}
};
module.exports = templateSettings;
