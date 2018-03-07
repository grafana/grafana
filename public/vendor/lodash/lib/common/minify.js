'use strict';

var _ = require('lodash'),
    fs = require('fs-extra'),
    uglify = require('uglify-js');

var uglifyOptions = require('./uglify.options');

/*----------------------------------------------------------------------------*/

/**
 * Asynchronously minifies the file at `srcPath`, writes it to `destPath`, and
 * invokes `callback` upon completion. The callback is invoked with one argument:
 * (error).
 *
 * If unspecified, `destPath` is `srcPath` with an extension of `.min.js`.
 * (e.g. the `destPath` of `path/to/foo.js` would be `path/to/foo.min.js`)
 *
 * @param {string} srcPath The path of the file to minify.
 * @param {string} [destPath] The path to write the file to.
 * @param {Function} callback The function invoked upon completion.
 * @param {Object} [option] The UglifyJS options object.
 */
function minify(srcPath, destPath, callback, options) {
  if (_.isFunction(destPath)) {
    if (_.isObject(callback)) {
      options = callback;
    }
    callback = destPath;
    destPath = undefined;
  }
  if (!destPath) {
    destPath = srcPath.replace(/(?=\.js$)/, '.min');
  }
  var output = uglify.minify(srcPath, _.defaults(options || {}, uglifyOptions));
  fs.writeFile(destPath, output.code, 'utf-8', callback);
}

module.exports = minify;
