/*****************************************************************
 *
 * Author   : Boguslaw Gorczyca
 * Created  : 2015-08-18 11:01
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

define([
    'angular',
    '../filters/netCrunchFilters',
    '../directives/netCrunchSpinner',
    '../directives/netCrunchFocusMe',
    '../directives/netCrunchKeyClick',
    '../directives/netCrunchTypeAhead',
    '../directives/netCrunchTree',
    '../directives/netCrunchVirtualScrollList'
  ],

function (angular) {

  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('netCrunchQueryCtrl', function($scope, $q, $sce, $timeout) {

    var DEFAULT_NODE_NAME = 'Select node',
        DEFAULT_NODE_ADDRESS = '',
        DEFAULT_NODE_ICON = '',
        DEFAULT_COUNTER_DISPLAY_NAME = 'Select counter',
        ERROR_NODE_MESSAGE = DEFAULT_NODE_NAME,
        ERROR_COUNTER_MESSAGE = DEFAULT_COUNTER_DISPLAY_NAME;

    var initTask = $q.defer(),
        ctrlReady = initTask.promise;

    $scope.counterListConfig = {
      1: {
        collapseButtonWidth: 14,
        contentWidth: 575,
        innerDepth: 12,
        paddingRight: 10,
        marginTop: 10,
        marginBottom: 10,
        height: 30
      },
      2: {
        collapseButtonWidth: 11,
        contentWidth: 550,
        innerDepth: 23,
        paddingRight: 0,
        marginTop: 0,
        marginBottom: 0,
        height: 20
      }
    };

    $scope.processingNodes = true;
    $scope.nodes = [];
    $scope.nodeNamePattern = '';
    $scope.nodeSelectionPosition = null;
    $scope.nodeSelectionShow = false;
    $scope.nodeSelectionFocus = false;
    $scope.target.nodeID = ($scope.target.nodeID == null) ? null : $scope.target.nodeID;

    $scope.processingCounters = true;
    $scope.counters = [];
    $scope.counterNamePattern = '';
    $scope.counterSelectionPosition = null;
    $scope.counterSelectionShow = false;
    $scope.counterSelectionFocus = false;

    function getNodesTabIndex() {
      return $scope.$id * 100000;
    }

    function getCountersTabIndex() {
      return getNodesTabIndex() + 50000;
    }

    function prepareCounterList(counters) {
      var counterList = [],
          tabIndex = getCountersTabIndex();

      Object.keys(counters).forEach(function(monitorId) {

        var monitorCounters;

        function createListElement(innerLevel, name, displayName, tabIndex) {
          return {
            innerLevel: innerLevel,
            selected: false,
            name: name,
            displayName: displayName,
            tabIndex: tabIndex
          };
        }

        if (monitorId > 0) {
          monitorCounters = counters[monitorId].counters;
          counterList.push(createListElement(1, '', counters[monitorId].name, 'none'));

          monitorCounters.forEach(function(counter) {
            tabIndex += 1;
            counterList.push(createListElement(2, counter.name, counter.displayName, tabIndex));
          });
        }
      });

      return counterList;
    }

    function updateCountersList(nodeID) {
      if (nodeID != null) {
        $scope.processingCounters = true;
        $scope.datasource.getCountersFromCache(nodeID).then(function(counters) {
          $scope.counters = prepareCounterList(counters);
          $scope.processingCounters = false;
        });
      }
    }

    function resetCountersList() {
      $scope.counters = [];
    }

    function setDefaultNodeValues(target){
      target.localVars.nodeIcon = DEFAULT_NODE_ICON;
      target.localVars.nodeName = DEFAULT_NODE_NAME;
      target.localVars.nodeAddress = DEFAULT_NODE_ADDRESS;
    }

    function setDefaultCounterValues(target){
      target.localVars.counterDisplayName = DEFAULT_COUNTER_DISPLAY_NAME;
    }

    function resetTargetLocalVars(target) {
      if (target != null) {
        target.localVars = {

          nodeFocus : false,
          processingNode : true,
          nodeName : '',
          nodeAddress : '',
          nodeIcon : '',
          nodeUpdated : false,

          counterFocus : false,
          processingCounter : true,
          counterDisplayName : '',
          counterUpdated : false,

          counterError : false,
          counterErrorMessage : ''
        };
        setDefaultNodeValues(target);
        setDefaultCounterValues(target);
      }
    }

    function updateNode (target) {
      var updatingTask = $q.defer();

      target.localVars.nodeIcon = '';
      target.localVars.nodeName = '';
      target.localVars.nodeAddress = '';

      if (target.nodeID != null) {
        target.localVars.processingNode = true;

        $scope.datasource.getNodeById(target.nodeID).then(function(node) {
          if (node != null) {
            target.localVars.nodeIcon = node.local.iconUrl;
            target.localVars.nodeName = node.values.Name;
            target.localVars.nodeAddress = node.values.Address;
            target.localVars.nodeUpdated = true;
          } else {
            setDefaultNodeValues(target);
            target.localVars.nodeUpdated = false;
          }

          target.localVars.processingNode = false;
          updatingTask.resolve();
        });
      } else {
        setDefaultNodeValues(target);
        target.localVars.nodeUpdated = false;
        target.localVars.processingNode = false;
        updatingTask.resolve();
      }

      return updatingTask.promise;
    }

    function prepareNodes(nodes) {
      $scope.processingNodes = true;
      $scope.nodes = [];
      $scope.nodes = nodes.map(function(node, $index) {
        var NODES_TAB_INDEX = getNodesTabIndex(),
            updatedNode;
        updatedNode = angular.copy(node);
        updatedNode.local.tabIndex = NODES_TAB_INDEX + $index;
        return updatedNode;
      });
      $scope.processingNodes = false;
    }

    function updateCounter (target) {
      var updatingTask = $q.defer();

      function setDefaultValues() {
        setDefaultCounterValues(target);
        target.localVars.counterUpdated = false;
        target.localVars.processingCounter = false;
        updatingTask.resolve();
      }

      target.localVars.counterDisplayName = '';
      if (target.nodeID != null) {
        $scope.datasource.getNodeById(target.nodeID).then(function(node) {
          if (node != null) {
            $scope.datasource.getCountersFromCache(target.nodeID).then(function(counters) {
              var counter = $scope.datasource.findCounterByName(counters, target.counterName);

              if (counter != null) {
                target.localVars.counterDisplayName = counter.displayName;
                target.localVars.counterUpdated = true;
                target.localVars.processingCounter = false;
                updatingTask.resolve();
              } else {
                setDefaultValues();
              }
            });
          } else {
            setDefaultValues();
          }
        });
      } else {
        target.counterName = '';
        setDefaultValues();
      }

      return updatingTask.promise;
    }

    function updateStatus (target) {
      var nodeUpdated = target.localVars.nodeUpdated,
          counterUpdated = target.localVars.counterUpdated,
          errorMessage = '';

      if ((nodeUpdated !== true) || (counterUpdated !== true)) {
        if (nodeUpdated === false) {
          errorMessage = ERROR_NODE_MESSAGE;
        } else {
          if (counterUpdated === false) {
            errorMessage = ERROR_COUNTER_MESSAGE;
          }
        }
        target.localVars.counterErrorMessage = errorMessage;
        target.localVars.counterError = true;
        target.counterDataComplete = false;
      } else {
        target.localVars.counterError = false;
        target.localVars.counterErrorMessage = '';
        target.counterDataComplete = true;
      }

      $scope.get_data();            //Refresh data on graph
    }

    function updateTarget (target) {
      resetTargetLocalVars(target);
      target.series = (target.series == null) ? Object.create(null) : target.series;
      target.series = $scope.datasource.validateSeriesTypes(target.series);
      return $q.all([updateNode(target), updateCounter(target)]).then(function() {
        updateStatus(target);
      });
    }

    function collapseTypeAheadNotifyToControllers() {
      var graphControllerScope = $scope.$parent.$parent;
      graphControllerScope.$broadcast('netCrunch-collapse-typeAhead', $scope.$id);
    }

    function nodeFocus () {
      $scope.target.localVars.nodeFocus = true;
    }

    function nodeSelectionTypeAheadShow() {
      $scope.nodeSelectionShow = true;
      $scope.nodeNamePattern = '';
      $scope.nodeSelectionFocus = true;
    }

    function nodeSelectionTypeAheadHide(setNodeFocus) {
      $scope.nodeSelectionShow = false;
      if (setNodeFocus === true) {
        nodeFocus();
      }
    }

    function counterFocus () {
      $scope.target.localVars.counterFocus = true;
    }

    function counterSelectionTypeAheadShow() {
      $scope.counterSelectionShow = true;
      $scope.counterNamePattern = '';
      $timeout(function() {
        $scope.$broadcast('ngTreeRedraw(counters-list' + $scope.$index + ')');
      }, 0);
      $scope.counterSelectionFocus = true;
    }

    function counterSelectionTypeAheadHide(setCounterFocus) {
      $scope.counterSelectionShow = false;
      if (setCounterFocus === true) {
        counterFocus();
      }
    }

    function typeAheadsHide() {
      nodeSelectionTypeAheadHide(false);
      counterSelectionTypeAheadHide(false);
    }

    $scope.nodeSelectionTypeAhead = function() {
      ctrlReady.then(function() {
        collapseTypeAheadNotifyToControllers();
        counterSelectionTypeAheadHide(false);
        nodeSelectionTypeAheadShow();
      });
    };

    $scope.counterSelectionTypeAhead = function() {
      ctrlReady.then(function() {
        collapseTypeAheadNotifyToControllers();
        nodeSelectionTypeAheadHide(false);
        counterSelectionTypeAheadShow();
      });
    };

    $scope.closeNodeSelectionTypeAhead = function() {
      nodeSelectionTypeAheadHide(true);
    };

    $scope.closeCounterSelectionTypeAhead = function() {
      counterSelectionTypeAheadHide(true);
    };

    $scope.init = function() {
      var connectionTag = 'hosts-updated(' + $scope.datasource.instanceId + ')';

      $scope.datasource.nodes.then(function(nodes) {
        prepareNodes(nodes);
      });

      $scope.$on(connectionTag, function(event, nodes) {
        prepareNodes(nodes);
      });

      $scope.target.counterDataComplete = true;
      updateTarget($scope.target).then(function() {
        initTask.resolve();
      });
    };

    $scope.seriesChange = function() {
      $scope.get_data();
    };

    $scope.selectNode = function(node) {
      var target = $scope.target;
      target.nodeID = node.values.Id;
      updateTarget(target).then(function() {
        if (target.localVars.counterUpdated === true) {
          nodeFocus();
        } else {
          $scope.counterSelectionTypeAhead();
        }
      });
      nodeSelectionTypeAheadHide(false);
    };

    $scope.selectCounter = function (counter) {
      var target = $scope.target;
      target.counterName = counter.name;
      updateTarget(target).then(function() {
        counterFocus();
      });
      counterSelectionTypeAheadHide(false);
    };

    $scope.$watch('target.nodeID', function() {
      resetCountersList();
      ctrlReady.then(function() {
        if ($scope.target.nodeID != null) {
          updateCountersList($scope.target.nodeID);
        }
      });
    });

    $scope.$on('netCrunch-collapse-typeAhead', function(event, scopeId) {
      if (scopeId !== $scope.$id) {
        typeAheadsHide();
      }
    });

    $scope.init();
  });
});
