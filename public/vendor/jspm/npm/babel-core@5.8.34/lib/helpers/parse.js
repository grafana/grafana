/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _babylon = require("babylon");

var babylon = _interopRequireWildcard(_babylon);

/**
 * Parse `code` with normalized options, collecting tokens and comments.
 */

exports["default"] = function (code) {
  var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var parseOpts = {
    allowImportExportEverywhere: opts.looseModules,
    allowReturnOutsideFunction: opts.looseModules,
    allowHashBang: true,
    ecmaVersion: 6,
    strictMode: opts.strictMode,
    sourceType: opts.sourceType,
    locations: true,
    features: opts.features || {},
    plugins: opts.plugins || {}
  };

  if (opts.nonStandard) {
    parseOpts.plugins.jsx = true;
    parseOpts.plugins.flow = true;
  }

  return babylon.parse(code, parseOpts);
};

module.exports = exports["default"];