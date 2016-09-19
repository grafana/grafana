'use strict';

delete global['__core-js_shared__'];

var _ = require('./lodash.js'),
    globals = require('lodash-doc-globals');

module.exports = {
  'babel': false,
  'globals': _.assign({ '_': _ }, globals)
};
