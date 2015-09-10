define([
  'angular',
  'lodash',
  './helperFunctions'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');
  var targetLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  module.controller('ZabbixAPIQueryCtrl', function($scope, $sce, templateSrv, zabbixHelperSrv) {

    $scope.init = function() {
      $scope.targetLetters = targetLetters;
      $scope.metric = {
        hostGroupList: [],
        hostList: [{name: '*', visible_name: 'All'}],
        applicationList: [{name: '*', visible_name: 'All'}],
        itemList: [{name: 'All'}]
      };

      // Update host group, host, application and item lists
      $scope.updateGroupList();
      $scope.updateHostList();
      $scope.updateAppList();
      $scope.updateItemList();

      setItemAlias();

      $scope.target.errors = validateTarget($scope.target);
    };

    /**
     * Take alias from item name by default
     */
    function setItemAlias() {
      if (!$scope.target.alias && $scope.target.item) {
        $scope.target.alias = $scope.target.item.name;
      }
    }

    $scope.targetBlur = function() {
      setItemAlias();
      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    /**
     * Call when host group selected
     */
    $scope.selectHostGroup = function() {
      $scope.updateHostList();
      $scope.updateAppList();
      $scope.updateItemList();

      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    /**
     * Call when host selected
     */
    $scope.selectHost = function() {
      $scope.updateAppList();
      $scope.updateItemList();

      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    /**
     * Call when application selected
     */
    $scope.selectApplication = function() {
      $scope.updateItemList();

      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    /**
     * Call when item selected
     */
    $scope.selectItem = function() {
      setItemAlias();
      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

    $scope.moveMetricQuery = function(fromIndex, toIndex) {
      _.move($scope.panel.targets, fromIndex, toIndex);
    };

    //////////////////////////////
    // SUGGESTION QUERIES
    //////////////////////////////

    /**
     * Update list of host groups
     */
    $scope.updateGroupList = function() {
      $scope.datasource.zabbixAPI.performHostGroupSuggestQuery().then(function (groups) {
        $scope.metric.groupList = [{name: '*', visible_name: 'All'}];
        addTemplatedVariables($scope.metric.groupList);
        $scope.metric.groupList = $scope.metric.groupList.concat(groups);
      });
    };

    /**
     * Update list of hosts
     */
    $scope.updateHostList = function() {
      var groups = $scope.target.group ? zabbixHelperSrv.splitMetrics(templateSrv.replace($scope.target.group.name)) : undefined;
      if (groups) {
        $scope.datasource.zabbixAPI.hostFindQuery(groups).then(function (hosts) {
          $scope.metric.hostList = [{name: '*', visible_name: 'All'}];
          addTemplatedVariables($scope.metric.hostList);
          $scope.metric.hostList = $scope.metric.hostList.concat(hosts);
        });
      }
    };

    /**
     * Update list of host applications
     */
    $scope.updateAppList = function() {
      var groups = $scope.target.group ? zabbixHelperSrv.splitMetrics(templateSrv.replace($scope.target.group.name)) : undefined;
      var hosts = $scope.target.host ? zabbixHelperSrv.splitMetrics(templateSrv.replace($scope.target.host.name)) : undefined;
      if (groups && hosts) {
        $scope.datasource.zabbixAPI.appFindQuery(hosts, groups).then(function (apps) {
          apps = _.map(_.uniq(_.map(apps, 'name')), function (appname) {
            return {name: appname};
          });
          $scope.metric.applicationList = [{name: '*', visible_name: 'All'}];
          addTemplatedVariables($scope.metric.applicationList);
          $scope.metric.applicationList = $scope.metric.applicationList.concat(apps);
        });
      }
    };

    /**
     * Update list of items
     */
    $scope.updateItemList = function() {
      var groups = $scope.target.group ? zabbixHelperSrv.splitMetrics(templateSrv.replace($scope.target.group.name)) : undefined;
      var hosts = $scope.target.host ? zabbixHelperSrv.splitMetrics(templateSrv.replace($scope.target.host.name)) : undefined;
      var apps = $scope.target.application ? zabbixHelperSrv.splitMetrics(templateSrv.replace($scope.target.application.name)) : undefined;
      if (groups && hosts && apps) {
        $scope.datasource.zabbixAPI.itemFindQuery(groups, hosts, apps).then(function (items) {
          // Show only unique item names
          var uniq_items = _.map(_.uniq(items, function (item) {
            return zabbixHelperSrv.expandItemName(item);
          }), function (item) {
            return {name: zabbixHelperSrv.expandItemName(item)};
          });
          $scope.metric.itemList = [{name: 'All'}];
          addTemplatedVariables($scope.metric.itemList);
          $scope.metric.itemList = $scope.metric.itemList.concat(uniq_items);
        });
      }
    };

    /**
     * Add templated variables to list of available metrics
     *
     * @param {Array} metricList List of metrics which variables add to
     */
    function addTemplatedVariables(metricList) {
      _.each(templateSrv.variables, function(variable) {
        metricList.push({
          name: '$' + variable.name,
          templated: true
        });
      });
    }

    //////////////////////////////
    // VALIDATION
    //////////////////////////////

    function validateTarget(target) {
      var errs = {};
      if (!target) {
        errs = 'Not defined';
      }
      return errs;
    }

  });

});
