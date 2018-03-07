'use strict';

var _ = require('lodash'),
    async = require('async'),
    glob = require('glob'),
    path = require('path');

var file = require('../common/file'),
    mapping = require('../common/mapping'),
    util = require('../common/util');

var templatePath = path.join(__dirname, 'template/modules'),
    template = file.globTemplate(path.join(templatePath, '*.jst'));

var aryMethods = _.union(
  mapping.aryMethod[1],
  mapping.aryMethod[2],
  mapping.aryMethod[3],
  mapping.aryMethod[4]
);

var categories = [
  'array',
  'collection',
  'date',
  'function',
  'lang',
  'math',
  'number',
  'object',
  'seq',
  'string',
  'util'
];

var ignored = [
  '_*.js',
  'core.js',
  'core.min.js',
  'fp.js',
  'index.js',
  'lodash.js',
  'lodash.min.js'
];

/**
 * Checks if `name` is a method alias.
 *
 * @private
 * @param {string} name The name to check.
 * @returns {boolean} Returns `true` if `name` is a method alias, else `false`.
 */
function isAlias(name) {
  return _.has(mapping.aliasToReal, name);
}

/**
 * Checks if `name` is a category name.
 *
 * @private
 * @param {string} name The name to check.
 * @returns {boolean} Returns `true` if `name` is a category name, else `false`.
 */
function isCategory(name) {
  return _.includes(categories, name);
}

/**
 * Checks if `name` belongs to a method that's passed thru and not wrapped.
 *
 * @private
 * @param {string} name The name to check.
 * @returns {boolean} Returns `true` if `name` is of a pass thru method,
 *  else `false`.
 */
function isThru(name) {
  return !_.includes(aryMethods, name);
}

/**
 * Gets metadata for `func`.
 *
 * @private
 * @param {Function} func The function to query.
 * @returns {*} Returns the metadata for `func`.
 */
function getTemplate(moduleName) {
  var data = {
    'name': _.get(mapping.aliasToReal, moduleName, moduleName),
    'mapping': mapping
  };

  if (isAlias(moduleName)) {
    return template.alias(data);
  }
  if (isCategory(moduleName)) {
    return template.category(data);
  }
  if (isThru(moduleName)) {
    return template.thru(data);
  }
  return template.module(data);
}

/*----------------------------------------------------------------------------*/

/**
 * Creates FP modules at the `target` path.
 *
 * @private
 * @param {string} target The output directory path.
 */
function build(target) {
  target = path.resolve(target);

  var fpPath = path.join(target, 'fp');

  // Glob existing lodash module paths.
  var modulePaths = glob.sync(path.join(target, '*.js'), {
    'nodir': true,
    'ignore': ignored.map(function(filename) {
      return path.join(target, filename);
    })
  });

  // Add FP alias and remapped module paths.
  _.each([mapping.aliasToReal, mapping.remap], function(data) {
    _.forOwn(data, function(realName, alias) {
      var modulePath = path.join(target, alias + '.js');
      if (!_.includes(modulePaths, modulePath)) {
        modulePaths.push(modulePath);
      }
    });
  });

  var actions = modulePaths.map(function(modulePath) {
    var moduleName = path.basename(modulePath, '.js');
    return file.write(path.join(fpPath, moduleName + '.js'), getTemplate(moduleName));
  });

  actions.unshift(file.copy(path.join(__dirname, '../../fp'), fpPath));
  actions.push(file.write(path.join(fpPath, '_falseOptions.js'), template._falseOptions()));
  actions.push(file.write(path.join(fpPath, '_util.js'), template._util()));
  actions.push(file.write(path.join(target, 'fp.js'), template.fp()));
  actions.push(file.write(path.join(fpPath, 'convert.js'), template.convert()));

  async.series(actions, util.pitch);
}

build(_.last(process.argv));
