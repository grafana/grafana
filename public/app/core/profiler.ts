import $ from 'jquery';
import angular from 'angular';

export class Profiler {
  panelsRendered: number;
  enabled: boolean;
  panelsInitCount: any;
  timings: any;
  digestCounter: any;
  $rootScope: any;
  scopeCount: any;
  window: any;

  init(config, $rootScope) {
    this.enabled = config.buildInfo.env === 'development';
    this.timings = {};
    this.timings.appStart = { loadStart: new Date().getTime() };
    this.$rootScope = $rootScope;
    this.window = window;

    if (!this.enabled) {
      return;
    }

    $rootScope.$watch(
      () => {
        this.digestCounter++;
        return false;
      },
      () => {}
    );

    $rootScope.onAppEvent('refresh', this.refresh.bind(this), $rootScope);
    $rootScope.onAppEvent('dashboard-fetch-end', this.dashboardFetched.bind(this), $rootScope);
    $rootScope.onAppEvent('dashboard-initialized', this.dashboardInitialized.bind(this), $rootScope);
    $rootScope.onAppEvent('panel-initialized', this.panelInitialized.bind(this), $rootScope);
  }

  refresh() {
    this.timings.query = 0;
    this.timings.render = 0;

    setTimeout(() => {
      console.log('panel count: ' + this.panelsInitCount);
      console.log('total query: ' + this.timings.query);
      console.log('total render: ' + this.timings.render);
      console.log('avg render: ' + this.timings.render / this.panelsInitCount);
    }, 5000);
  }

  dashboardFetched() {
    this.timings.dashboardLoadStart = new Date().getTime();
    this.panelsInitCount = 0;
    this.digestCounter = 0;
    this.panelsInitCount = 0;
    this.panelsRendered = 0;
    this.timings.query = 0;
    this.timings.render = 0;
  }

  dashboardInitialized() {
    setTimeout(() => {
      console.log('Dashboard::Performance Total Digests: ' + this.digestCounter);
      console.log('Dashboard::Performance Total Watchers: ' + this.getTotalWatcherCount());
      console.log('Dashboard::Performance Total ScopeCount: ' + this.scopeCount);

      var timeTaken = this.timings.lastPanelInitializedAt - this.timings.dashboardLoadStart;
      console.log('Dashboard::Performance All panels initialized in ' + timeTaken + ' ms');

      // measure digest performance
      var rootDigestStart = window.performance.now();
      for (var i = 0; i < 30; i++) {
        this.$rootScope.$apply();
      }

      console.log('Dashboard::Performance Root Digest ' + (window.performance.now() - rootDigestStart) / 30);
    }, 3000);
  }

  getTotalWatcherCount() {
    var count = 0;
    var scopes = 0;
    var root = $(document.getElementsByTagName('body'));

    var f = function(element) {
      if (element.data().hasOwnProperty('$scope')) {
        scopes++;
        angular.forEach(element.data().$scope.$$watchers, function() {
          count++;
        });
      }

      angular.forEach(element.children(), function(childElement) {
        f($(childElement));
      });
    };

    f(root);
    this.scopeCount = scopes;
    return count;
  }

  renderingCompleted(panelId, panelTimings) {
    // add render counter to root scope
    // used by phantomjs render.js to know when panel has rendered
    this.panelsRendered = (this.panelsRendered || 0) + 1;

    // this window variable is used by backend rendering tools to know
    // all panels have completed rendering
    this.window.panelsRendered = this.panelsRendered;

    if (this.enabled) {
      panelTimings.renderEnd = new Date().getTime();
      this.timings.query += panelTimings.queryEnd - panelTimings.queryStart;
      this.timings.render += panelTimings.renderEnd - panelTimings.renderStart;
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
export { profiler };
