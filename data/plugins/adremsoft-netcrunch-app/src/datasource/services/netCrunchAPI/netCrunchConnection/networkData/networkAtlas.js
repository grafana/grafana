/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

import { NetCrunchNetworkNode } from './networkNode';
import { NetCrunchNetworkMap } from './networkMap';
import { NetCrunchNodes } from './networkNodes';

const
  ATLAS_ROOT_ID = '',
  MONITORING_PACKS_NET_ID = 3,
  PRIVATE_PROPERTIES = {
    connection: Symbol('connection'),
    nodes: Symbol('nodes'),
    atlasMaps: Symbol('atlasMaps'),
    orphans: Symbol('orphans')
  },
  ROOT_MAP_REC = {
    local: {},
    getValues: () => {                  // eslint-disable-line
      return {
        DisplayName: 'Network Atlas',
        MapClassTag: 'dynfolder',
        NetIntId: ATLAS_ROOT_ID
      };
    }
  };

class NetCrunchNetworkAtlas {

  constructor(netCrunchServerConnection) {
    this[PRIVATE_PROPERTIES.connection] = netCrunchServerConnection;
    this[PRIVATE_PROPERTIES.nodes] = new NetCrunchNodes();
    this[PRIVATE_PROPERTIES.atlasMaps] = new Map();
    this[PRIVATE_PROPERTIES.atlasMaps].set(ATLAS_ROOT_ID, new NetCrunchNetworkMap(ROOT_MAP_REC));
    this[PRIVATE_PROPERTIES.orphans] = [];
  }

  addNetworkMap(networkMap) {
    const self = this;

    function isMonitoringPacksFolder(map) {
      return (map.netId === MONITORING_PACKS_NET_ID);
    }

    function addChildrenFromOrphans(map) {
      self[PRIVATE_PROPERTIES.orphans] = self[PRIVATE_PROPERTIES.orphans]
        .filter((orphan) => {
          if (orphan.parentId === map.netId) {
            map.addChild(orphan);
            return false;
          }
          return true;
        });
    }

    function addMapToParent(map) {
      if (self[PRIVATE_PROPERTIES.atlasMaps].has(map.parentId)) {
        self[PRIVATE_PROPERTIES.atlasMaps]
          .get(map.parentId)
          .addChild(map);
      } else {
        self[PRIVATE_PROPERTIES.orphans].push(map);
      }
    }

    self[PRIVATE_PROPERTIES.atlasMaps].set(networkMap.netId, networkMap);
    addChildrenFromOrphans(networkMap);
    if (!isMonitoringPacksFolder(networkMap)) {
      addMapToParent(networkMap);
    }
  }

  addMap(mapRec) {
    const networkMap = new NetCrunchNetworkMap(mapRec);
    this.addNetworkMap(networkMap);
  }

  addNode(nodeRec) {
    const node = new NetCrunchNetworkNode(nodeRec, this[PRIVATE_PROPERTIES.connection]);
    this[PRIVATE_PROPERTIES.nodes].add(node);
  }

  get nodes() {
    return this[PRIVATE_PROPERTIES.nodes];
  }

  get atlasMaps() {
    return this[PRIVATE_PROPERTIES.atlasMaps];
  }

  get networkAtlasRoot() {
    return this.atlasMaps.get(ATLAS_ROOT_ID);
  }

  get monitoringPacks() {
    if (this[PRIVATE_PROPERTIES.atlasMaps].has(MONITORING_PACKS_NET_ID)) {
      return this[PRIVATE_PROPERTIES.atlasMaps].get(MONITORING_PACKS_NET_ID);
    }
    return null;
  }

}

export {
  NetCrunchNetworkAtlas
};
