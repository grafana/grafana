///<reference path="../../headers/common.d.ts" />

import coreModule from '../../core/core_module';
import {appEvents} from 'app/core/core';

export class DataSourcesCtrl {
  datasources: any;
  navModel: any;

  /** @ngInject */
  constructor(
    private $scope,
    private backendSrv,
    private datasourceSrv,
    private $location,
    private navModelSrv) {

    this.navModel = this.navModelSrv.getNav('cfg', 'datasources', 0);
    this.navigateToUrl = this.navigateToUrl.bind(this);
    backendSrv.get('/api/datasources').then(result => {
      this.datasources = result;
    });

    appEvents.on('location-change', payload => {
      this.navigateToUrl(payload.href);
    });
  }

  navigateToUrl(url) {
    // debugger;
    this.$location.path(url);
    this.$location.replace();
  }

  removeDataSourceConfirmed(ds) {

    this.backendSrv.delete('/api/datasources/' + ds.id)
    .then(() => {
      this.$scope.appEvent('alert-success', ['Datasource deleted', '']);
    }, () => {
      this.$scope.appEvent('alert-error', ['Unable to delete datasource', '']);
    }).then(() => {
      this.backendSrv.get('/api/datasources')
      .then((result) => {
        this.datasources = result;
      });
      this.backendSrv.get('/api/frontend/settings')
      .then((settings) => {
        this.datasourceSrv.init(settings.datasources);
      });
    });
  }

  removeDataSource(ds) {

    this.$scope.appEvent('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete datasource ' + ds.name + '?',
      yesText: "Delete",
      icon: "fa-trash",
      onConfirm: () => {
        this.removeDataSourceConfirmed(ds);
      }
    });
  }

}

coreModule.controller('DataSourcesCtrl', DataSourcesCtrl);
