///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';

export class DataSourcesCtrl {
  datasources: any;
  navModel: any;

  /** @ngInject */
  constructor(
    private $scope,
    private $location,
    private $http,
    private backendSrv,
    private datasourceSrv,
    private navModelSrv
  ) {

    this.navModel = this.navModelSrv.getDatasourceNav(0);

    backendSrv.get('/api/datasources').then(result => {
      this.datasources = result;
    });
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
