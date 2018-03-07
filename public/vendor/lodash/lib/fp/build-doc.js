'use strict';

var _ = require('lodash'),
    fs = require('fs-extra'),
    path = require('path');

var file = require('../common/file'),
    mapping = require('../common/mapping'),
    util = require('../common/util');

var templatePath = path.join(__dirname, 'template/doc'),
    template = file.globTemplate(path.join(templatePath, '*.jst'));

var argNames = ['a', 'b', 'c', 'd'];

var templateData = {
  'mapping': mapping,
  'toArgOrder': toArgOrder,
  'toFuncList': toFuncList
};

/**
 * Converts arranged argument `indexes` into a named argument string
 * representation of their order.
 *
 * @private
 * @param {number[]} indexes The arranged argument indexes.
 * @returns {string} Returns the named argument string.
 */
function toArgOrder(indexes) {
  var reordered = [];
  _.each(indexes, function(newIndex, index) {
    reordered[newIndex] = argNames[index];
  });
  return '`(' + reordered.join(', ') + ')`';
}

/**
 * Converts `funcNames` into a chunked list string representation.
 *
 * @private
 * @param {string[]} funcNames The function names.
 * @returns {string} Returns the function list string.
 */
function toFuncList(funcNames) {
  var chunks = _.chunk(funcNames.slice().sort(), 5),
      lastChunk = _.last(chunks),
      last = lastChunk ? lastChunk.pop() : undefined;

  chunks = _.reject(chunks, _.isEmpty);
  lastChunk = _.last(chunks);

  var result = '`' + _.map(chunks, function(chunk) {
    return chunk.join('`, `') + '`';
  }).join(',\n`');

  if (last == null) {
    return result;
  }
  if (_.size(chunks) > 1 || _.size(lastChunk) > 1) {
    result += ',';
  }
  result += ' &';
  result += _.size(lastChunk) < 5 ? ' ' : '\n';
  return result + '`' + last + '`';
}

/*----------------------------------------------------------------------------*/

/**
 * Creates the FP-Guide wiki at the `target` path.
 *
 * @private
 * @param {string} target The output file path.
 */
function build(target) {
  target = path.resolve(target);
  fs.writeFile(target, template.wiki(templateData), util.pitch);
}

build(_.last(process.argv));
