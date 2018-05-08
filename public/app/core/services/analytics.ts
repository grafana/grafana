import $ from 'jquery';
import coreModule from 'app/core/core_module';
import config from 'app/core/config';

export class Analytics {
  /** @ngInject */
  constructor(private $rootScope, private $location) {}

  gaInit() {
    $.ajax({
      url: 'https://www.google-analytics.com/analytics.js',
      dataType: 'script',
      cache: true,
    });
    var ga = ((<any>window).ga =
      (<any>window).ga ||
      function() {
        (ga.q = ga.q || []).push(arguments);
      });
    ga.l = +new Date();
    ga('create', (<any>config).googleAnalyticsId, 'auto');
    ga('set', 'anonymizeIp', true);
    return ga;
  }

  init() {
    this.$rootScope.$on('$viewContentLoaded', () => {
      var track = { page: this.$location.url() };
      var ga = (<any>window).ga || this.gaInit();
      ga('set', track);
      ga('send', 'pageview');
    });
  }
}

/** @ngInject */
function startAnalytics(googleAnalyticsSrv) {
  if ((<any>config).googleAnalyticsId) {
    googleAnalyticsSrv.init();
  }
}

coreModule.service('googleAnalyticsSrv', Analytics).run(startAnalytics);
