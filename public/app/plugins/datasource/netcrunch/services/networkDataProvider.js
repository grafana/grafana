/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-06-18
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

define([
    'angular',
    'lodash'
  ],

  function (angular, _) {

    'use strict';

    var module = angular.module('grafana.services');

    /* global angular */

    module
        .factory('atlasTree', function (adrem) {
            var mapTree = {
                    '' : {
                        children : []
                    }
                },
                orphans = [],
                nodes = {},
                iconSize = 25,

                MAP_ICON_ID_UNKNOWN = 100;

            function getDeviceIcon(deviceTypeXML) {
                if (deviceTypeXML !== '' && deviceTypeXML != null) {
                    var doc = $.parseXML(deviceTypeXML),
                        devtype = $(doc).find('devtype');
                    return devtype.attr('iconid') || MAP_ICON_ID_UNKNOWN;
                } else {
                    return 0;
                }
            }

            function getMapIconUrl (iconId, size) {
                size = size || 32;
                return adrem.ncSrv.IMapIcons.GetIcon.asURL(iconId, size);
            }

            function pushUniqueChildToMap (map, child) {
                var isUnique;

                isUnique = map.children.every(function(mapChild){
                    return (mapChild.data.values.NetIntId !== child.data.values.NetIntId);
                });

                if (isUnique === true) {
                    map.children.push(child);
                }
            }

            return {
                tree : mapTree,
                nodes : nodes,

                addMapToIndex : function (mapRec) {
                    var parentId = mapRec.local.parentId,
                        netId = mapRec.values.NetIntId;

                    mapTree[netId] = {
                        data : mapRec,
                        children : []
                    };

                    orphans = orphans.filter(function (orphan) {
                        if (orphan.data.local.parentId === netId) {
                            pushUniqueChildToMap(mapTree[netId], orphan);
                            return false;
                        }
                        return true;
                    });

                    if (mapTree[parentId] != null) {
                        pushUniqueChildToMap(mapTree[parentId], mapTree[netId]);
                    } else {
                        orphans.push(mapTree[netId]);
                    }
                },

                addNode : function (nodeRec) {
                    nodeRec.local.iconUrl = getMapIconUrl(getDeviceIcon(nodeRec.values.DeviceType), iconSize);
                    nodes[nodeRec.values.Id] = nodeRec;
                },

                generateMapList : function(){

                    var mapList = [];

                    function sortMaps(first, second){
                        if (first.data.values.DisplayName === second.data.values.DisplayName) {
                            return 0;
                        } else {
                            if (first.data.values.DisplayName < second.data.values.DisplayName) {
                                return -1;
                            } else {
                                return 1;
                            }
                        }
                    }

                    function performMapList(maps, innerLevel, parentIndex){
                        maps.sort(sortMaps);
                        maps.forEach(function(map){
                            map.data.local.innerLevel = innerLevel;
                            map.data.local.parentLinearIndex = parentIndex;
                            if (map.data.local.isFolder === true) {
                                mapList.push(map);
                                performMapList(map.children, innerLevel + 1, mapList.length - 1);
                            } else {
                                mapList.push(map);
                            }
                        });
                    }

                    performMapList(mapTree[''].children, 1, 'root');
                    return mapList;
                }
            };
        });

    module
        .factory('networkDataProvider', function ($q, $rootScope, adrem, atlasTree) {
            var networkData,
                hostsData;

            function openRemoteData(table, query, processFunction, broadcastMessageName) {
                var networkData = new adrem.RemoteDataListStore('ncSrv', 1000);

                networkData.on('changed', function () {
                    $rootScope.$broadcast(broadcastMessageName);
                });

                if (processFunction != null) {
                    networkData.on('record-changed', function (data) {
                        if (networkData.data != null && networkData.data.length > 0) {
                            data.forEach(processFunction, this);
                        }
                    });
                }

                networkData.open(table, query);
                return networkData;
            }

            function decodeNetworkData(record) {
                var mapsData;

                function addNodesToNetwork(network) {
                    var nodeData,
                        len, i;

                    network.local.nodes = [];
                    len = network.values.HostMapData[0];

                    for (i = 1; i <= len; i++) {
                        nodeData = network.values.HostMapData[i];
                        if (nodeData[0] === 0 || nodeData[0] === 5) {
                            network.local.nodes.push(parseInt(nodeData[1], 10));
                        }
                    }
                }

                record.local.parentId = parseInt(record.values.NetworkData[0], 10);
                if (isNaN(record.local.parentId) === true) { record.local.parentId = ''; }

                record.local.isFolder = (record.values.MapClassTag === 'dynfolder' || Array.isArray(record.values.NetworkData[1]));

                if (record.local.isFolder) {
                    mapsData = record.values.NetworkData[1];
                    if (Array.isArray(mapsData)) {            // otherwise it can be empty object instead of empty array
                        record.local.maps = mapsData.map(function (id) {
                            return parseInt(id, 10);
                        });
                    }

                    if (record.values.MapClassTag === 'fnet') {                   //Add nodes into physical segments map
                        addNodesToNetwork(record);
                    }
                } else {
                    addNodesToNetwork(record);
                }

                return record;
            }

            return {
                init : function () {
                    var performanceViewsNetIntId = 2,
                        monitoringPacksNetIntId = 3;

                    var processHostsData = function (data){
                        var host = Object.create(null);
                        host.local = Object.create(null);
                        host.values = data.getValues();
                        atlasTree.addNode(host);
                    };

                    var processMapData = function (data) {
                        var map = Object.create(null);
                        map.local = data.local;
                        map.values = data.getValues();
                        atlasTree.addMapToIndex(decodeNetworkData(map));
                    };

                    hostsData = openRemoteData('Hosts', 'Select Id, Name, Address, DeviceType, GlobalDataNode ',
                        processHostsData, 'host-data-changed');

                    networkData = openRemoteData('Networks', 'Select NetIntId, DisplayName, HostMapData, IconId, ' +
                        'MapType, NetworkData, MapClassTag ' +
                        'where (MapClassTag != \'policynet\') && (MapClassTag != \'pnet\') && ' +
                        '(MapClassTag != \'dependencynet\') && ' +
                        '(MapClassTag != \'issuesnet\') && (MapClassTag != \'all\') && ' +
                        '(NetIntId != ' + performanceViewsNetIntId + ') && ' +
                        '(NetIntId != ' + monitoringPacksNetIntId + ')',
                        processMapData, 'network-data-changed');

                    return $q.all([hostsData, networkData]);
                }
            };
        });
    });
