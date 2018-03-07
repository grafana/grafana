/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

const
  PRIVATE_PROPERTIES = {
    local: Symbol('local'),
    values: Symbol('values')
  };

class NetCrunchNetworkMap {

  constructor(mapRec) {

    /* eslint-disable no-param-reassign */

    function addNodesToNetworkMap(local, values) {
      if (values.HostMapData != null) {
        for (let i = 1, len = values.HostMapData[0]; i <= len; i += 1) {
          const nodeData = values.HostMapData[i];
          if ((nodeData[0] === 0) || (nodeData[0] === 5)) {
            local.nodesId.push(parseInt(nodeData[1], 10));
          }
        }
      }
    }

    function decodeNetworkMapData(local, values) {

      local.netId = values.NetIntId || '';

      local.parentId = (values.NetworkData != null) ? parseInt(values.NetworkData[0], 10) : '';
      if (isNaN(local.parentId)) {
        local.parentId = '';
      }

      local.isFolder = ((values.MapClassTag === 'dynfolder') ||
                        ((values.NetworkData != null) && Array.isArray(values.NetworkData[1])));

      if (local.isFolder) {
        const mapsData = (values.NetworkData != null) ? values.NetworkData[1] : [];

        if (Array.isArray(mapsData)) {                        // otherwise it can be empty object instead of empty array
          local.maps = mapsData.map(id => parseInt(id, 10));
        }

        if (values.MapClassTag === 'fnet') {                  // Add nodes into physical segments map
          addNodesToNetworkMap(local, values);
        }
      } else {
        addNodesToNetworkMap(local, values);
      }
    }

    /* eslint-enable no-param-reassign */

    if (mapRec != null) {
      this[PRIVATE_PROPERTIES.local] = mapRec.local;
      this[PRIVATE_PROPERTIES.values] = mapRec.getValues();
    } else {
      this[PRIVATE_PROPERTIES.local] = {};
      this[PRIVATE_PROPERTIES.values] = {};
    }

    this[PRIVATE_PROPERTIES.local].nodesId = [];
    decodeNetworkMapData(this[PRIVATE_PROPERTIES.local], this[PRIVATE_PROPERTIES.values]);
    this[PRIVATE_PROPERTIES.local].children = [];
  }

  get netId() {
    return this[PRIVATE_PROPERTIES.local].netId;
  }

  get parentId() {
    return this[PRIVATE_PROPERTIES.local].parentId;
  }

  get nodesId() {
    return this[PRIVATE_PROPERTIES.local].nodesId;
  }

  get allNodesId() {
    const nodesSet = new Set();

    function addArrayToSet(array, set) {
      array.forEach(item => set.add(item));
      return set;
    }

    if (this.isFolder) {

      if (this[PRIVATE_PROPERTIES.values].MapClassTag === 'fnet') {     // Add nodes into physical segment map
        addArrayToSet(this.nodesId, nodesSet);
      }

      this.children.forEach((child) => {
        addArrayToSet(child.allNodesId, nodesSet);
      });

    } else {
      addArrayToSet(this.nodesId, nodesSet);
    }

    return Array.from(nodesSet);
  }

  get isFolder() {
    return this[PRIVATE_PROPERTIES.local].isFolder;
  }

  get children() {
    return this[PRIVATE_PROPERTIES.local].children;
  }

  get displayName() {
    return this[PRIVATE_PROPERTIES.values].DisplayName || '';
  }

  get allChildren() {

    function sortMapsByName(first, second) {
      return first.displayName.localeCompare(second.displayName);
    }

    function createMapList(map, innerLevel, parentIndex) {
      let mapList = [];

      map.children
        .sort(sortMapsByName)
        .forEach((child) => {
          mapList.push({
            map: child,
            innerLevel,
            parentIndex
          });

          if ((map.isFolder) && (innerLevel <= 2)) {
            const currentIndex = isNaN(parentIndex) ? mapList.length - 1 : parentIndex + mapList.length;
            mapList = mapList.concat(createMapList(child, innerLevel + 1, currentIndex));
          }
        });
      return mapList;
    }

    return createMapList(this, 1, 'root');
  }

  addChild(networkMap) {
    const isUnique = this.children.every(child => (child.netId !== networkMap.netId));
    if (isUnique === true) {
      this.children.push(networkMap);
    }
  }

  getChildMapByDisplayName(displayName) {
    let result = null;

    this.children.some((childMap) => {
      if (childMap.displayName.toUpperCase() === displayName.toUpperCase()) {
        result = childMap;
        return true;
      }
      return false;
    });

    return result;
  }

}

export {
  NetCrunchNetworkMap
};
