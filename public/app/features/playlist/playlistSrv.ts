///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import coreModule from '../../core/core_module';
import kbn from 'app/core/utils/kbn';

class PlaylistSrv {
  private cancelPromise: any
  private dashboards: any
  private index: number
  private interval: any

  /** @ngInject */
  constructor(private $rootScope:any, private $location:any, private $timeout:any) {
  }

  next() {
    this.$timeout.cancel(this.cancelPromise);

    angular.element(window).unbind('resize');
    var dash = this.dashboards[this.index % this.dashboards.length];

    this.$location.url('dashboard/' + dash.uri);

    this.index++;
    this.cancelPromise = this.$timeout(() => { this.next(); }, this.interval);
  }

  prevfunction() {
    this.index = Math.max(this.index - 2, 0);
    this.next();
  }

  start(dashboards, interval) {
    this.stop();

    this.index = 0;
    this.interval = kbn.interval_to_ms(interval);

    this.dashboards = dashboards;
    this.$rootScope.playlistSrv = this;

    this.cancelPromise = this.$timeout(() => { this.next(); }, this.interval);
    this.next();
  }

  stop() {
    this.index = 0;

    if (this.cancelPromise) {
        this.$timeout.cancel(this.cancelPromise);
    }

    this.$rootScope.playlistSrv = null;
  }
}

coreModule.service('playlistSrv', PlaylistSrv)
