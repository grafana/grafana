'use strict';

var _ = require('lodash'),
    fs = require('fs-extra'),
    glob = require('glob'),
    path = require('path');

var minify = require('../common/minify.js');

/*----------------------------------------------------------------------------*/

/**
 * Creates a [fs.copy](https://github.com/jprichardson/node-fs-extra#copy)
 * function with `srcPath` and `destPath` partially applied.
 *
 * @memberOf file
 * @param {string} srcPath The path of the file to copy.
 * @param {string} destPath The path to copy the file to.
 * @returns {Function} Returns the partially applied function.
 */
function copy(srcPath, destPath) {
  return _.partial(fs.copy, srcPath, destPath);
}

/**
 * Creates an object of base name and compiled template pairs that match `pattern`.
 *
 * @memberOf file
 * @param {string} pattern The glob pattern to be match.
 * @returns {Object} Returns the object of compiled templates.
 */
function globTemplate(pattern) {
  return _.transform(glob.sync(pattern), function(result, filePath) {
    var key = path.basename(filePath, path.extname(filePath));
    result[key] = _.template(fs.readFileSync(filePath, 'utf8'));
  }, {});
}

/**
 * Creates a `minify` function with `srcPath` and `destPath` partially applied.
 *
 * @memberOf file
 * @param {string} srcPath The path of the file to minify.
 * @param {string} destPath The path to write the file to.
 * @returns {Function} Returns the partially applied function.
 */
function min(srcPath, destPath) {
  return _.partial(minify, srcPath, destPath);
}

/**
 * Creates a [fs.writeFile](https://nodejs.org/api/fs.html#fs_fs_writefile_file_data_options_callback)
 * function with `filePath` and `data` partially applied.
 *
 * @memberOf file
 * @param {string} destPath The path to write the file to.
 * @param {string} data The data to write to the file.
 * @returns {Function} Returns the partially applied function.
 */
function write(destPath, data) {
  return _.partial(fs.writeFile, destPath, data);
}

/*----------------------------------------------------------------------------*/

module.exports = {
  'copy': copy,
  'globTemplate': globTemplate,
  'min': min,
  'write': write
};
