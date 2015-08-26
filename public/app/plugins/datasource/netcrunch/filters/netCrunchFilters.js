/*****************************************************************
 *
 * Author   : Boguslaw Gorczyca
 * Created  : 2015-08-26 11:01
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

define([
    'angular',
    'lodash',
    'config',
    './netCrunchCommonFilters'
  ],

  function (angular, _, config) {

    'use strict';

    var module = angular.module('grafana.filters');

    /* global angular, console, module, netCrunchCommonFilters */


    module.filter('netCrunchNodeAddress', function(){
        return netCrunchCommonFilters.nodeAddress;
    });

    module.filter('netCrunchMap', function() {
        var lastPattern,
            lastResult;

        function addMapToTree(maps, mapIndex, filteredMapsTree) {

            function addMapNodeToTree (maps, mapIndex, filteredMapsTree, addChildren) {
                var parentId,
                    treeNode,
                    hasNextChild,
                    i,
                    childCount,
                    currentInnerLevel;

                parentId = maps[mapIndex].data.local.parentLinearIndex;

                if (filteredMapsTree[mapIndex] != null) {
                    treeNode = filteredMapsTree[mapIndex];
                } else {
                    treeNode = {
                        id : mapIndex,
                        children : [],
                        parentId : parentId
                    };
                }

                if (addChildren === true) {
                    hasNextChild = true;
                    i = mapIndex + 1;
                    childCount = maps.length;
                    currentInnerLevel = maps[mapIndex].data.local.innerLevel;

                    while (hasNextChild === true) {
                        if ((i < childCount) && (maps[i].data.local.innerLevel > currentInnerLevel)) {
                            if (filteredMapsTree[i] == null) {
                                filteredMapsTree[i] = {
                                    id: i,
                                    parentId: mapIndex
                                };
                                treeNode.children.push(filteredMapsTree[i]);
                            }
                            i += 1;
                        } else {
                            hasNextChild = false;
                        }
                    }
                }

                filteredMapsTree[mapIndex] = treeNode;
                return filteredMapsTree;
            }

            function addMapParentsToTree (maps, mapIndex, filteredMapsTree) {
                var parentId = maps[mapIndex].data.local.parentLinearIndex;

                function childExist (children, childIndex) {
                    return children.some(function(child) {
                        return child.id === childIndex;
                    });
                }

                if (filteredMapsTree[parentId] == null) {
                    filteredMapsTree[parentId] = {
                        id : parentId,
                        children : []
                    };
                }

                if (childExist(filteredMapsTree[parentId].children, mapIndex) === false) {
                    filteredMapsTree[parentId].children.push(filteredMapsTree[mapIndex]);

                    if (parentId !== 'root') {
                        filteredMapsTree[parentId].parentId = maps[parentId].data.local.parentLinearIndex;
                        addMapParentsToTree(maps, parentId, filteredMapsTree);
                    }
                }
                return filteredMapsTree;
            }

            if (filteredMapsTree[mapIndex] == null) {
                filteredMapsTree = addMapNodeToTree(maps, mapIndex, filteredMapsTree, false);
                filteredMapsTree = addMapParentsToTree(maps, mapIndex, filteredMapsTree);
            }
            return filteredMapsTree;
        }

        function flattenTreeToList (maps, mapsTree) {
            var resultList = [];

            if (mapsTree.id != null) {
                maps[mapsTree.id].data.local.isDisplayFolder = false;
                resultList.push(maps[mapsTree.id]);
            }

            if ((mapsTree.children != null) && (mapsTree.children instanceof Array)) {
                mapsTree.children.forEach(function (child) {
                    if ((child != null) && (child.children != null)) {
                        resultList = resultList.concat(flattenTreeToList(maps, child));
                    } else {
                        resultList.push(maps[child.id]);
                    }
                });

                if (mapsTree.id != null) {
                    if (mapsTree.children.length > 0) {
                        maps[mapsTree.id].data.local.isDisplayFolder = true;
                        maps[mapsTree.id].data.local.isCollapse = false;
                    }
                }
            }
            return resultList;
        }

        return function (maps, pattern) {
            var filteredMapsTree = {
                    root : {
                        children : []
                    }
                },
                mapName,
                matchedMaps = [],
                filteredMaps = [];

            if (maps != null) {
                pattern = pattern.toLowerCase();

                if (lastPattern !== pattern){
                    lastPattern = pattern;

                    maps.forEach(function(map, index){
                        if ((map != null) && (map.data != null) && (map.data.values != null)) {
                            mapName = map.data.values.DisplayName.toLowerCase();
                            if (mapName.indexOf(pattern) >= 0) {
                                matchedMaps.push(index);
                            }
                        }
                    });

                    matchedMaps.forEach(function(mapIndex){
                        filteredMapsTree = addMapToTree(maps, mapIndex, filteredMapsTree);
                    });
                    filteredMaps = flattenTreeToList(maps, filteredMapsTree.root);
                    lastResult = filteredMaps;
                }
            }
            return lastResult;
        };
    })

    module.filter('netCrunchNodes', function(){

        function toLowerCaseIfNotNull(value) {
            var result = '';

            if (value != null) {
                result = value.toLowerCase();
            }
            return result;
        }

        function isNotGlobalDataNode (node) {
            return (node.values.GlobalDataNode === false);
        }

        return function(nodes, pattern){
            var filteredNodes = [],
                nodeAddress,
                nodeName;

            if (nodes != null) {
                pattern = pattern.toLowerCase();

                filteredNodes = nodes.filter(function(node){
                    if ((node != null) && (node.values != null) && (isNotGlobalDataNode(node))) {
                        nodeAddress = toLowerCaseIfNotNull(node.values.Address);
                        nodeName = toLowerCaseIfNotNull(node.values.Name);

                        if ((nodeAddress.indexOf(pattern) >= 0) ||
                            (nodeName.indexOf(pattern) >= 0)) {
                            return true;
                        }
                    }
                    return false;
                });
            }
            return filteredNodes;
        };
    });

    module.filter('netCrunchMapNodes', function() {
        return netCrunchCommonFilters.mapNodes;
    });

    module.filter('netCrunchOrderNodes', function(){
        return netCrunchCommonFilters.orderNodes;
    });

    module.filter('netCrunchCounter', function () {

        function removeEmptyCounterGroup (counters) {
            return counters.filter(function(counter, index){
                if (counter.innerLevel === 1) {
                    if (counters[index + 1] != null) {
                        if (counters[index + 1].innerLevel > 1) {
                            return true;
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                } else {
                    return true;
                }
            });
        }

        return function (counters, pattern) {
            var filteredCounters;

            if (counters != null) {
                pattern = pattern.toLowerCase();

                if (pattern === '') {
                    filteredCounters = counters;
                } else {
                    filteredCounters = counters.filter(function (counter) {
                        if (counter.innerLevel === 1) {
                            return true;
                        } else {
                            if (counter.innerLevel === 2) {
                                if (counter.displayName.toLowerCase().indexOf(pattern) >= 0) {
                                    return true;
                                } else {
                                    return false;
                                }
                            } else {
                                return false;
                            }
                        }
                    });
                    filteredCounters = removeEmptyCounterGroup(filteredCounters);
                }
            }

            return filteredCounters;
        };
    });
});
