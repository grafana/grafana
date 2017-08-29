define([
    'angular',
    'lodash',
    'moment',
    'jsdiff',
    './logsDash',
    'app/core/utils/datemath'
  ],
  function (angular, _, moment, Diff, logsDash, dateMath) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.filter('formatTimeRange', function () {
      return function (text) {
        if (!text) return;

        var from = text.from, to = text.to;
        var args = Array.prototype.slice.call(arguments), time = args[0], relative = args[1], index = args[2];
        moment.isMoment(from) && (from = moment(from));
        moment.isMoment(to) && (to = moment(to));

        from = dateMath.parse(from, false);
        to = dateMath.parse(to, true);

        relative = parseInt(relative);
        !_.isNaN(relative) && (
          from = moment.utc(from).subtract(relative, 'days'),
          to = moment.utc(to).subtract(relative, 'days')
        );

        return moment.utc(index === 0 ? from : to).format("YYYY-MM-DD");
      };
    });

    module.controller('LogsCtrl', function ($scope, contextSrv, $rootScope, timeSrv, $modal, datasourceSrv, backendSrv, $q) {
      var currentLogTab = 0;
      var panelMetas    = logsDash.rows;
      var logClusterPanel = logsDash.logClusterPanel;
      var logComparePanel = logsDash.logComparePanel;

      $scope.tabsCache = {};
      $scope.resultCache = {};
      $scope.selectedCompare = [];
      $scope.tabs = [
        {
          "active": true,
          "title": "日志搜索 1",
          "id": 1,  // should be the same with panelMeta[0].id
        }
      ];

      // 搜索框帮助
      $scope.queryInputOptions = [
        { key: 'host:', helpInfo: '查询特定host日志 (例如: host:centos1)' },
        { key: 'type:', helpInfo: '查询特定type日志 (例如: type:mysql)' },
        { key: 'message:', helpInfo: '查询正则匹配的日志 (例如: message:/INFO/)' },
        { key: 'AND', helpInfo: '联合查询' },
        { key: 'OR', helpInfo: '联合查询' },
        { key: 'NOT', helpInfo: '联合查询' }
      ];
      $scope.selectQueryOption = function (queryKey) {
        ($scope.query === "*" || $scope.query === undefined) && ($scope.query = "");
        $scope.query = $scope.query +  " " + queryKey;
        $("#dropdownMenu1").focus();
      };
      $scope.showQueryOption = function (event) {
        var code = event.keyCode || event.which;
        (code == 32) && $("#dropdownMenu1").click();  // Space Code
      };

      function fillRowData(row, patternMap) {
        row = JSON.stringify(row);
        for (var pattern in patternMap) {
          row = row.replace(new RegExp(pattern, "g"), patternMap[pattern]);
        }
        return JSON.parse(row);
      };

      // 先记住当前的 query 等信息
      function saveCurQueryInfo(tabId) {
        var queryInfo = {
          "query": $scope.query,
          "size" : $scope.size,
          "timeShift": $scope.timeShift,
          "currentRelativeTime": $scope.currentRelativeTime,
          "logFilter": $scope.logFilter,
          "currentFilter": $scope.currentFilter,
          "timeRange": angular.copy($scope.dashboard.time),
          "row": angular.copy($scope.dashboard.rows[0])
        };
        $scope.tabsCache[$scope.dashboard.rows[0].id] = queryInfo;
      }

      function resetRow(tabId) {
        saveCurQueryInfo(tabId);

        // reset for view
        Object.assign($scope, tabId ? $scope.tabsCache[tabId] : {
          "query": "",
          "size": "500",
          "timeShift": "-1d",
          "currentRelativeTime": "1天以前",
          "logFilter": "",
          "currentFilter": "无"
        });

        // reset for requesting dashboard
        var panels = $scope.dashboard.rows[0].panels;
        _.forEach(panels, function (panel) {
          panel.scopedVars && panel.scopedVars.logFilter && (panel.scopedVars.logFilter = tabId ? $scope.tabsCache[tabId].logFilter : "");
          _.forEach(panel.targets, function (target) {
            target.size && (target.size = tabId ? $scope.tabsCache[tabId].size : 500);
            (typeof target.query !== "undefined") && (target.query = tabId ? $scope.tabsCache[tabId].query : "");
            (typeof target.timeShift !== "undefined") && (target.timeShift = tabId ? $scope.tabsCache[tabId].timeShift : "-1d");
          });
        });
        $scope.dashboard.rows[0].id = tabId ? tabId : $scope.dashboard.rows[0].id + 1;

        // NOTE: 1) 直接修改 $scope.dashboard.time 且 broadcast refresh 了.没有作用. why?
        //       2) timeSrv.setTime() will broadcast "refresh", 所以在修改了 size/query/id 等设置之后调用. 否则上面的修改没有意义.
        //          而如果直接修改 rows[0], 会触发 refresh 两次.
        timeSrv.setTime(tabId ? $scope.tabsCache[tabId].timeRange : { from: "now-6h", to: "now" });
      };

      $scope.currentRelativeTime = "1天以前";
      $scope.logCompare = function(timeShift) {
        $scope.timeShift = timeShift;
        $scope.dashboard.rows[0].panels[2].targets[1].timeShift = timeShift;
        $rootScope.$broadcast('refresh');
        $scope.currentRelativeTime = timeShift.replace("-", "").replace("d", "天") + "以前";
      };

      $scope.currentFilter = "无";
      $scope.logFilterOperator = function (rule) {
        $scope.logFilter = rule;
        $scope.dashboard.rows[0].panels[2].scopedVars.logFilter = rule;
        $rootScope.$broadcast('refresh');
        $scope.currentFilter = rule + "日志";
      };

      $scope.showInputModal = function() {
        var newScope = $scope.$new();
        newScope.logCompare = $scope.logCompare;
        newScope.shift = "-1d";
        $scope.appEvent('show-modal', {
          src: 'public/app/features/logs/partials/input_time_shift.html',
          modalClass: 'modal-no-header confirm-modal',
          scope: newScope
        });
      };

      $scope.isShowKnows = function(type) {
        $scope.appEvent('show-modal', {
          src: 'public/app/features/logs/partials/logs_knowledge.html',
          modalClass: 'modal-kb',
          scope: $scope.$new(),
        });
      };

      $scope.showSearchCompareModal = function () {
        // prepare for select ng-model
        _.forEach($scope.tabs, function (item) {
          var tabId = item.id;
          if (!$scope.tabsCache[tabId]) return;
          item.queryHeader = $scope.resultCache[tabId].queryHeader;
        });

        var searchCompareModal = $modal({
          scope: $scope,
          templateUrl: '/public/app/features/logs/partials/log_search_compare_modal.html',
          show: false
        });
        searchCompareModal.$promise.then(searchCompareModal.show);
      };

      $scope.reQuery = function () {
        var panels = $scope.dashboard.rows[0].panels;
        _.forEach(panels, function (panel) {
          _.forEach(panel.targets, function (target) {
            (typeof target.query !== "undefined") && (target.query = $scope.query);
          });
        });

        $rootScope.$broadcast('refresh');
      };

      $scope.getLogSize = function(size) {
        var panels = $scope.dashboard.rows[0].panels;
        _.forEach(panels, function (panel) {
          _.forEach(panel.targets, function (target) {
            if (target.size === size) return;
            target.size && (target.size = size);
          });
        });

        $rootScope.$broadcast('refresh');
      };

      $scope.hideGuide = function() {
        $scope.showSearchGuide = false;
      };

      $scope.init = function () {
        $scope.query = "*";
        $scope.size = 500;
        $scope.timeShift = "-1d";

        var row = _.cloneDeep(panelMetas[0]);
        row = fillRowData(row, {
          "\\$SIZE": $scope.size,
          "\\$QUERY": $scope.query,
          "\\$TIMESHIFT": $scope.timeShift,
          "\\$LOGFILTER": $scope.logFilter
        });

        $scope.initDashboard({
          meta: {canStar: false, canShare: false, canEdit: false, canSave: false},
          dashboard: {
            title: "整合分析",
            id: "123",
            rows: [row],
            time: {from: "now-6h", to: "now"}
          }
        }, $scope);

        // 优化: 绑定事件写在 panel table render 里
        $('body').on('click', '.tab-2 tbody tr td:nth-child(2)', function () {
          var newScope = $scope.$new();
          var cid = parseInt($(this).next().find('div:eq(0)').text());
          var curTabId = $scope.dashboard.rows[0].id;

          newScope.bsTableData = _.findWhere($scope.resultCache[curTabId].logCluster, {'cid': cid}).members;
          var clusterLogSourceModal = $modal({
            scope: newScope,
            templateUrl: 'public/app/features/logs/partials/log_cluster_modal.html',
            show: false
          });

          clusterLogSourceModal.$promise.then(clusterLogSourceModal.show);
        });
      };
      $scope.init();

      // cache repsonse data when datasource.query successed
      $scope.$on('data-saved', function (event, payload) {
        var curTabId = $scope.dashboard.rows[0].id;
        !$scope.resultCache[curTabId] && ($scope.resultCache[curTabId] = {});
        $scope.resultCache[curTabId][payload.id] = payload.data;

        saveCurQueryInfo(curTabId);
      });

      // 新建 日志搜索tab
      $scope.pushTab = function () {
        currentLogTab = Object.keys($scope.tabsCache).length;
        resetRow();

        $scope.tabs.push({
          "active": true,
          "title": "日志搜索 " + $scope.dashboard.rows[0].id,
          "id": $scope.dashboard.rows[0].id
        });
      };

      // 切换 日志搜索1-n
      $scope.switchCurLogTab = function (tabId, index) {
        if ($scope.dashboard.rows[0].id == tabId) return;

        // 优化: 当前所有数据加载完成 才允许切换
        // ($scope.dashboard.loaded === 4) && resetRow(tabId);
        resetRow(tabId);
      };

      // 懒加载 聚合&对比，只对第一次有用
      $scope.logOperate = function (tab) {
        if (tab === 0) return;

        var row = tab === 1 ? _.cloneDeep(logClusterPanel) : _.cloneDeep(logComparePanel);
        row = fillRowData(row, {
          "\\$SIZE": $scope.size,
          "\\$QUERY": $scope.query,
          "\\$TIMESHIFT": $scope.timeShift,
          "\\$LOGFILTER": $scope.logFilter
        });
        $scope.dashboard.rows[0].panels[tab] = row;
      };

      // 横向对比
      var textTitle = [];
      $scope.getSearchQuery = function (selected, index) {
        textTitle[index] = selected.title;
        $scope.selectedCompare[index] = selected;
      };

      $scope.logSearchCompare = function () {
        if (!$scope.selectedCompare.length) return;
        var payload = _.map($scope.selectedCompare, "queryHeader").join('');

        backendSrv.logCluster({
          method: "POST",
          url: "/log/diff",
          data: payload
        }).then(function (res) {
          var list = transformToDiffData(res.data);
          $("#diffoutput").html(Diff.buildView({
            baseTextLines: _.map(list[0], 'cluster').join("\n"),
            newTextLines : _.map(list[1], 'cluster').join("\n"),
            baseTextName : textTitle[0],
            newTextName  : textTitle[1],
            viewType     : 0
          }));
        });
      };

      function transformToDiffData(data) {
        var list = [[], []];

        _.forEach(data, function (item) {
          _.forEach(item.members, function (member) {
            list[member.group].push({
              'cluster': item.message,
              'member' : member.message,
              '_id': member.id,
              'timestamp': member.timestamp
            });
          });
        });

        list[0] = _.sortBy(list[0], ['timestamp']);
        list[1] = _.sortBy(list[1], ['timestamp']);
        return list;
      }

    });
  });
