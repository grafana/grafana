/*****************************************************************
 *
 * Author   : Boguslaw Gorczyca
 * Created  : 2015-08-18 11:01
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

/* global angular, console */

define([
    'angular',
    'lodash',
    'config',
    '../filters/netCrunchFilters',
    '../directives/netCrunchSpinner',
    '../directives/netCrunchTree',
    '../directives/netCrunchVirtualScrollList',
    '../directives/netCrunchTypeAhead',
    '../directives/netCrunchFocusMe',
    '../directives/netCrunchKeyClick'
],

function (angular, _) {

  'use strict';

  var module = angular.module('grafana.controllers'),
      COUNTER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      NODES_TAB_INDEX = 25000,
      COUNTERS_TAB_INDEX = 75000;

  module.controller('netCrunchQueryCtrl', function($scope, $q, $sce, $timeout) {

    var DEFAULT_NODE_NAME = 'Select node',
        DEFAULT_NODE_ADDRESS = '',
        DEFAULT_NODE_ICON = '',
        DEFAULT_COUNTER_DISPLAY_NAME = 'Select counter',
        ERROR_NODE_MESSAGE = DEFAULT_NODE_NAME,
        ERROR_COUNTER_MESSAGE = DEFAULT_COUNTER_DISPLAY_NAME;

    var initTask = $q.defer(),
        ctrlReady = initTask.promise,
        currentTargetIndex = null;

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
    $scope.currentNodeId = null;

    $scope.processingCounters = true;
    $scope.counters = [];
    $scope.counterNamePattern = '';
    $scope.counterSelectionPosition = null;
    $scope.counterSelectionShow = false;
    $scope.counterSelectionFocus = false;

    function prepareCounterList(counters) {
      var counterList = [],
        tabIndex = COUNTERS_TAB_INDEX;

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

      $scope.get_data();    //Refresh data on graph
    }

    function updateTarget (target) {
      resetTargetLocalVars(target);
      target.series = (target.series == null) ? Object.create(null) : target.series;
      target.series = $scope.datasource.validateSeriesTypes(target.series);
      return $q.all([updateNode(target), updateCounter(target)]).then(function() {
        updateStatus(target);
      });
    }

    function nodeSelectionTypeAheadShow() {
      $scope.nodeSelectionShow = true;
      $scope.nodeNamePattern = '';
      $scope.nodeSelectionFocus = true;
    }

    function nodeSelectionTypeAheadHide(setNodeFocus) {
      $scope.nodeSelectionShow = false;
      if (setNodeFocus === true) {
        nodeFocus(currentTargetIndex);
      }
    }

    function counterSelectionTypeAheadShow() {
      $scope.counterSelectionShow = true;
      $scope.counterNamePattern = '';
      $timeout(function() {
        $scope.$broadcast('ngTreeRedraw(counters-list)');
      }, 0);
      $scope.counterSelectionFocus = true;
    }

    function counterSelectionTypeAheadHide(setCounterFocus){
      $scope.counterSelectionShow = false;
      if (setCounterFocus === true) {
        counterFocus(currentTargetIndex);
      }
    }

    function typeAheadsHide() {
      nodeSelectionTypeAheadHide(false);
      counterSelectionTypeAheadHide(false);
    }

    function nodeFocus (targetIndex) {
      $scope.panel.targets[targetIndex].localVars.nodeFocus = true;
    }

    function counterFocus (targetIndex) {
      $scope.panel.targets[targetIndex].localVars.counterFocus = true;
    }

    $scope.init = function() {
      var panelTargets = $scope.panel.targets,
          updateTargets = [];

      $scope.panel = $scope.datasource.updatePanel($scope.panel);
      $scope.counterLetters = COUNTER_LETTERS;
      $scope.datasource.nodes.then(function(nodes) {
        $scope.nodes = nodes.map(function(node, $index) {
          node.local.tabIndex = NODES_TAB_INDEX + $index;
          return node;
        });
        $scope.processingNodes = false;
      });

      panelTargets.forEach(function(target) {
        target.counterDataComplete = true;
        updateTargets.push(updateTarget(target));
      });

      $q.all(updateTargets).then(function() {
        if (panelTargets.length > 0) {
          panelTargets[0].localVars.nodeFocus = true;
        }
        initTask.resolve();
      });
    };

    $scope.duplicateCounterQuery = function (index) {
      var clone = angular.copy($scope.panel.targets[index]);
      typeAheadsHide();
      $scope.panel.targets.push(clone);
    };

    $scope.moveCounterQuery = function (indexFrom, indexTo) {
      typeAheadsHide();
      _.move($scope.panel.targets, indexFrom, indexTo);
    };

    $scope.seriesChange = function(target) {
      $scope.get_data();
    };

    $scope.nodeSelectionTypeAhead = function(targetIndex) {
      ctrlReady.then(function() {
        currentTargetIndex = targetIndex;
        counterSelectionTypeAheadHide(false);
        $scope.nodeSelectionPosition = targetIndex;
        nodeSelectionTypeAheadShow();
      });
    };

    $scope.counterSelectionTypeAhead = function(targetIndex) {
      var target = $scope.panel.targets[targetIndex];

      ctrlReady.then(function() {
        currentTargetIndex = targetIndex;

        if (($scope.currentNodeId !== target.nodeID) && (target.nodeID !== null)) {
          $scope.currentNodeId = target.nodeID;
        }

        nodeSelectionTypeAheadHide(false);
        $scope.counterSelectionPosition = targetIndex;
        counterSelectionTypeAheadShow();
      });
    };

    $scope.closeNodeSelectionTypeAhead = function() {
      nodeSelectionTypeAheadHide(true);
    };

    $scope.closeCounterSelectionTypeAhead = function() {
      counterSelectionTypeAheadHide(true);
    };

    $scope.selectNode = function(node) {
      var currentTarget = $scope.panel.targets[currentTargetIndex];

      currentTarget.nodeID = node.values.Id;
      $scope.currentNodeId = node.values.Id;
      updateTarget(currentTarget).then(function() {
        if (currentTarget.localVars.counterUpdated === true) {
          nodeFocus(currentTargetIndex);
        } else {
          $scope.counterSelectionTypeAhead(currentTargetIndex);
        }
      });
      nodeSelectionTypeAheadHide(false);
    };

    $scope.selectCounter = function (counter) {
      var currentTarget = $scope.panel.targets[currentTargetIndex];

      currentTarget.counterName = counter.name;
      updateTarget(currentTarget).then(function() {
        counterFocus(currentTargetIndex);
      });
      counterSelectionTypeAheadHide(false);
    };

    $scope.$watch('currentNodeId', function() {
      resetCountersList();
      updateCountersList($scope.currentNodeId);
    });

    $scope.$on('addDataQuery', function(event, args) {
      var addedTarget = $scope.panel.targets[args.targetID];
      typeAheadsHide();
      updateTarget(addedTarget);
      addedTarget.localVars.nodeFocus = true;
    });

    $scope.$on('removeDataQuery', function() {
      typeAheadsHide();
    });

  });
});
