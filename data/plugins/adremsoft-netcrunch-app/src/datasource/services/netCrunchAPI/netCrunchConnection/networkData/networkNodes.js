/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

import { NetCrunchNodesOperations } from './nodesOperations';

const
  PRIVATE_PROPERTIES = {
    map: Symbol('map'),
    array: Symbol('array')
  };

class NetCrunchNodes {

  constructor() {
    this[PRIVATE_PROPERTIES.map] = new Map();
    this[PRIVATE_PROPERTIES.array] = [];
  }

  add(node) {
    this[PRIVATE_PROPERTIES.map].set(node.id, node);
    this[PRIVATE_PROPERTIES.array].push(node);
  }

  mapNodes(map = null) {

    if (map != null) {
      const result = [];

      map.allNodesId.forEach((nodeId) => {
        if (this[PRIVATE_PROPERTIES.map].has(nodeId)) {
          result.push(this[PRIVATE_PROPERTIES.map].get(nodeId));
        }
      });
      return result;
    }

    return this[PRIVATE_PROPERTIES.array];
  }

  getAllNodes() {
    return this[PRIVATE_PROPERTIES.array];
  }

  getNodeById(nodeId) {
    return this[PRIVATE_PROPERTIES.map].get(nodeId);
  }

  get operations() {                  // eslint-disable-line
    return NetCrunchNodesOperations;
  }

}

export {
  NetCrunchNodes
};
