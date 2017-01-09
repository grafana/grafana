'use strict';

var async = require('async'),
    path = require('path');

var file = require('../common/file'),
    util = require('../common/util');

var basePath = path.join(__dirname, '..', '..'),
    distPath = path.join(basePath, 'dist'),
    filename = 'lodash.js';

var baseLodash = path.join(basePath, filename),
    distLodash = path.join(distPath, filename);

/*----------------------------------------------------------------------------*/

/**
 * Creates browser builds of Lodash at the `target` path.
 *
 * @private
 * @param {string} target The output directory path.
 */
function build() {
  async.series([
    file.copy(baseLodash, distLodash),
    file.min(distLodash)
  ], util.pitch);
}

build();
