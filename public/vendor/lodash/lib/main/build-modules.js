'use strict';

var _ = require('lodash'),
    async = require('async'),
    path = require('path');

var file = require('../common/file'),
    util = require('../common/util');

var basePath = path.join(__dirname, '..', '..'),
    distPath = path.join(basePath, 'dist');

var filePairs = [
  [path.join(distPath, 'lodash.core.js'), 'core.js'],
  [path.join(distPath, 'lodash.core.min.js'), 'core.min.js'],
  [path.join(distPath, 'lodash.min.js'), 'lodash.min.js']
];

/*----------------------------------------------------------------------------*/

/**
 * Creates supplementary Lodash modules at the `target` path.
 *
 * @private
 * @param {string} target The output directory path.
 */
function build(target) {
  var actions = _.map(filePairs, function(pair) {
    return file.copy(pair[0], path.join(target, pair[1]));
  });

  async.series(actions, util.pitch);
}

build(_.last(process.argv));
