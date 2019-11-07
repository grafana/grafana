import $ from 'jquery';
import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';

export class Analytics {
  /** @ngInject */
  constructor(private $rootScope: GrafanaRootScope, private $location: any) {}

  gaInit() {
    $.ajax({
      url: 'https://www.google-analytics.com/analytics.js',
      dataType: 'script',
      cache: true,
    });
    const ga = ((window as any).ga =
      (window as any).ga ||
      //tslint:disable-next-line:only-arrow-functions
      function() {
        (ga.q = ga.q || []).push(arguments);
      });
    ga.l = +new Date();
    ga('create', (config as any).googleAnalyticsId, 'auto');
    ga('set', 'anonymizeIp', true);
    return ga;
  }

  init() {
    this.$rootScope.$on('$viewContentLoaded', () => {
      const track = { page: this.$location.url() };
      const ga = (window as any).ga || this.gaInit();
      ga('set', track);
      ga('send', 'pageview');
    });
  }
}

/** @ngInject */
function startAnalytics(googleAnalyticsSrv: Analytics) {
  if ((config as any).googleAnalyticsId) {
    googleAnalyticsSrv.init();
  }
}

coreModule.service('googleAnalyticsSrv', Analytics).run(startAnalytics);
