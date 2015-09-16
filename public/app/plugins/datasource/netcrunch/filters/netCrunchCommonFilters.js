/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-06-01
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

//jshint ignore: start

'use strict';

var netCrunchCommonFilters = function () {

  var commonFilters = {

    nodeAddress: function (address) {
      var result = address;

      if ((address != null) && (address !== '')) {
        result = '(' + address + ')';
      }
      return result;
    },

    mapNodes: function(nodes, map) {

      function pushUniqueValueToArray(destination, value) {
        if (destination.indexOf(value) < 0) {
          destination.push(value);
        }
      }

      function getMapNodes (map) {
        var nodes = [];

        if (map.data.local.isFolder === false) {
          nodes = map.data.local.nodes;
        } else {
          if (map.data.values.MapClassTag === 'fnet') {                  //Add nodes into physical segment map
            map.data.local.nodes.forEach(function(node) {
              pushUniqueValueToArray(nodes, node);
            });
          }

          map.children.forEach(function(subMap) {
            getMapNodes(subMap).forEach(function(node) {
              pushUniqueValueToArray(nodes, node);
            });
          });
        }
        return nodes;
      }

      var mapNodes = [],
          nodesIndex = Object.create(null);

      if (map != null) {
        nodes.forEach(function(node) {
          if ((node.values != null) && (node.values.Id != null)) {
            nodesIndex[node.values.Id] = node;
          }
        });

        getMapNodes(map).forEach(function(nodeId) {
          if (nodesIndex[nodeId] != null) {
            mapNodes.push(nodesIndex[nodeId]);
          }
        });
        return mapNodes;
      } else {
        return nodes;
      }
    },

    orderNodes : function(nodes) {
      function compareAddressIP(addressOne, addressTwo) {
        var addressOneItems = addressOne.split('.'),
            addressTwoItems = addressTwo.split('.'),
            i,
            n;

        for (i = 0, n = Math.max(addressOneItems.length, addressTwoItems.length); i < n; i += 1) {
          if (addressOneItems[i] !== addressTwoItems[i]) {
            return (addressOneItems[i] - addressTwoItems[i]);
          }
        }
      }

      function compareNodeData(nodeA, nodeB) {
        var result = 0,
            nodeAName = ((nodeA.values != null) && (nodeA.values.Name != null)) ?
                          nodeA.values.Name.toLowerCase() : '',
            nodeBName = ((nodeB.values != null) && (nodeB.values.Name != null)) ?
                          nodeB.values.Name.toLowerCase() : '',
            nodeAAddress = ((nodeA.values != null) && (nodeA.values.Address != null)) ? nodeA.values.Address : '',
            nodeBAddress = ((nodeB.values != null) && (nodeB.values.Address != null)) ? nodeB.values.Address : '';

        if ((nodeAName !== '') && (nodeBName !== '')){
          if (nodeAName === nodeBName) {
            result = 0;
          } else {
            if (nodeAName < nodeBName) {
              result = -1;
            } else {
              result = 1;
            }
          }
        } else {
          if ((nodeAName === '') && (nodeBName === '')) {
            result = compareAddressIP(nodeAAddress, nodeBAddress);
          } else {
            if (nodeAName !== '') { result = -1; }
            if (nodeBName !== '') { result = 1; }
          }
        }
        return result;
      }

      nodes = nodes.filter(function(node) {
        return (node.values != null);
      });
      return nodes.sort(compareNodeData);
    }
  };

  return commonFilters;
}();
