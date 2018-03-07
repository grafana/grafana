/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

import { AdremWebWorker } from '../../adrem/module';

const THREAD_WORKER_NODES_NUMBER = 1000;

let webWorkerSingleton = null;

function sortNodesByNameAndAddress(nodes) {

  function compareAddressIP(addressOne, addressTwo) {
    const
      addressOneItems = addressOne.split('.'),
      addressTwoItems = addressTwo.split('.');

    for (let i = 0, n = Math.max(addressOneItems.length, addressTwoItems.length); i < n; i += 1) {
      if (addressOneItems[i] !== addressTwoItems[i]) {
        return (addressOneItems[i] < addressTwoItems[i]) ? -1 : 1;
      }
    }
    return 0;
  }

  function getNodeProperty(node, propertyName) {
    return ((node != null) && (node[propertyName] != null)) ? node[propertyName] : '';
  }

  function compareNodeData(nodeA, nodeB) {
    const
      nodeAName = getNodeProperty(nodeA, 'name').toLowerCase(),
      nodeBName = getNodeProperty(nodeB, 'name').toLowerCase(),
      nodeAAddress = getNodeProperty(nodeA, 'address'),
      nodeBAddress = getNodeProperty(nodeB, 'address');
    let result = 0;

    if ((nodeAName !== '') && (nodeBName !== '')) {
      result = nodeAName.localeCompare(nodeBName);
    } else if ((nodeAName === '') && (nodeBName === '')) {
      result = compareAddressIP(nodeAAddress, nodeBAddress);
    } else {
      if (nodeAName !== '') { result = -1; }
      if (nodeBName !== '') { result = 1; }
    }
    return result;
  }

  return nodes
    .filter(node => ((node != null) && ((node.id != null) && ((node.name != null) && (node.address != null)))))
    .sort(compareNodeData);

}

function getWebWorker() {
  if (webWorkerSingleton == null) {
    const workerBuilder = AdremWebWorker.webWorkerBuilder();
    workerBuilder.addFunctionCode(sortNodesByNameAndAddress, true);
    webWorkerSingleton = workerBuilder.getWebWorker();
  }
  return webWorkerSingleton;
}

class NetCrunchNodesOperations {

  static asyncSortByNameAndAddress(nodes = []) {
    return new Promise((resolve) => {
      if (nodes.length < THREAD_WORKER_NODES_NUMBER) {
        const result = sortNodesByNameAndAddress(nodes);
        resolve(result);
      } else {
        const nodesRemoteBuffer = [];

        nodes.forEach((node, index) => {
          nodesRemoteBuffer.push({
            id: node.id,
            name: node.name,
            address: node.address,
            index
          });
        });

        getWebWorker().sortNodesByNameAndAddress(nodesRemoteBuffer)
          .then((sortedNodes) => {
            const result = [];
            sortedNodes.forEach(node => result.push(nodes[node.index]));
            resolve(result);
          });
      }
    });
  }

  static deviceTypeFilter(nodes = [], deviceTypePattern) {
    return nodes.filter(node => node.checkDeviceType(deviceTypePattern));
  }

}

export {
  NetCrunchNodesOperations
};
