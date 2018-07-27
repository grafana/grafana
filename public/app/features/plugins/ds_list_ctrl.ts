import coreModule from '../../core/core_module';
import _ from 'lodash';

export class DataSourcesCtrl {
  datasources: any;
  unfiltered: any;
  navModel: any;
  searchQuery: string;

  /** @ngInject */
  constructor(private $scope, private backendSrv, private datasourceSrv, private navModelSrv) {
    this.navModel = this.navModelSrv.getNav('cfg', 'datasources', 0);
    backendSrv.get('/api/datasources').then(result => {
      this.datasources = result;
      this.unfiltered = result;
    });
  }

  onQueryUpdated() {
    let regex = new RegExp(this.searchQuery, 'ig');
    this.datasources = _.filter(this.unfiltered, item => {
      regex.lastIndex = 0;
      return regex.test(item.name) || regex.test(item.type);
    });
  }

  removeDataSourceConfirmed(ds) {
    this.backendSrv
      .delete('/api/datasources/' + ds.id)
      .then(
        () => {
          this.$scope.appEvent('alert-success', ['Datasource deleted', '']);
        },
        () => {
          this.$scope.appEvent('alert-error', ['Unable to delete datasource', '']);
        }
      )
      .then(() => {
        this.backendSrv.get('/api/datasources').then(result => {
          this.datasources = result;
        });
        this.backendSrv.get('/api/frontend/settings').then(settings => {
          this.datasourceSrv.init(settings.datasources);
        });
      });
  }

  removeDataSource(ds) {
    this.$scope.appEvent('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete datasource ' + ds.name + '?',
      yesText: 'Delete',
      icon: 'fa-trash',
      onConfirm: () => {
        this.removeDataSourceConfirmed(ds);
      },
    });
  }
}

coreModule.controller('DataSourcesCtrl', DataSourcesCtrl);
