///<reference path="../headers/common.d.ts" />
//
import $ from 'jquery';
import _ from 'lodash';
import angular from 'angular';

export class Profiler {
  panelsRendered: number;
  enabled: boolean;
  panels: any[];
  panelsInitCount: any;
  timings: any;
  digestCounter: any;
  $rootScope: any;
  scopeCount: any;

  init(config, $rootScope) {
    this.enabled = config.buildInfo.env === 'development';
    this.timings = {};
    this.timings.appStart = { loadStart: new Date().getTime() };
    this.$rootScope = $rootScope;

    if (!this.enabled) {
      return;
    }

    $rootScope.$watch(() => {
      this.digestCounter++;
      return false;
    }, () => {});

    $rootScope.$on('refresh', this.refresh.bind(this));
    $rootScope.onAppEvent('dashboard-fetched', this.dashboardFetched.bind(this));
    $rootScope.onAppEvent('dashboard-initialized', this.dashboardInitialized.bind(this));
    $rootScope.onAppEvent('panel-initialized', this.panelInitialized.bind(this));
  }

  refresh() {
    this.panels = [];

    setTimeout(() => {
      var totalRender = 0;
      var totalQuery = 0;

      for (let panelTiming of this.panels) {
        totalRender += panelTiming.render;
        totalQuery += panelTiming.query;
      }

      console.log('panel count: ' + this.panels.length);
      console.log('total query: ' + totalQuery);
      console.log('total render: ' + totalRender);
      console.log('avg render: ' + totalRender / this.panels.length);
    }, 5000);
  }

  dashboardFetched() {
    this.timings.dashboardLoadStart = new Date().getTime();
    this.panelsInitCount = 0;
    this.digestCounter = 0;
    this.panelsInitCount = 0;
    this.panelsRendered = 0;
    this.panels = [];
  }

  dashboardInitialized() {
    setTimeout(() => {
      console.log("Dashboard::Performance Total Digests: " + this.digestCounter);
      console.log("Dashboard::Performance Total Watchers: " + this.getTotalWatcherCount());
      console.log("Dashboard::Performance Total ScopeCount: " + this.scopeCount);

      var timeTaken = this.timings.lastPanelInitializedAt - this.timings.dashboardLoadStart;
      console.log("Dashboard::Performance All panels initialized in " + timeTaken + " ms");

      // measure digest performance
      var rootDigestStart = window.performance.now();
      for (var i = 0; i < 30; i++) {
        this.$rootScope.$apply();
      }

      console.log("Dashboard::Performance Root Digest " + ((window.performance.now() - rootDigestStart) / 30));
    }, 3000);
  }

  getTotalWatcherCount() {
    var count = 0;
    var scopes = 0;
    var root = $(document.getElementsByTagName('body'));

    var f = function (element) {
      if (element.data().hasOwnProperty('$scope')) {
        scopes++;
        angular.forEach(element.data().$scope.$$watchers, function () {
          count++;
        });
      }

      angular.forEach(element.children(), function (childElement) {
        f($(childElement));
      });
    };

    f(root);
    this.scopeCount = scopes;
    return count;
  }

  renderingCompleted(panelId, panelTimings) {
    this.panelsRendered++;

    if (this.enabled) {
      panelTimings.renderEnd = new Date().getTime();
      this.panels.push({
        panelId: panelId,
        query: panelTimings.queryEnd - panelTimings.queryStart,
        render: panelTimings.renderEnd - panelTimings.renderStart,
      });
    }
  }

  panelInitialized() {
    if (!this.enabled) {
      return;
    }

    this.panelsInitCount++;
    this.timings.lastPanelInitializedAt = new Date().getTime();
  }

}

var profiler = new Profiler();
export {profiler};
