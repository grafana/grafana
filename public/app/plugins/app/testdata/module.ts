///<reference path="../../../headers/common.d.ts" />

export class ConfigCtrl {
  static template = '';

  appEditCtrl: any;

  /** @ngInject **/
  constructor(private backendSrv) {
    this.appEditCtrl.setPreUpdateHook(this.initDatasource.bind(this));
  }

  initDatasource() {
    return this.backendSrv.get('/api/datasources').then(res => {
      var found = false;
      for (let ds of res) {
        if (ds.type === "grafana-testdata-datasource") {
          found = true;
        }
      }

      if (!found) {
        var dsInstance = {
          name: 'Grafana TestData',
          type: 'grafana-testdata-datasource',
          access: 'direct',
          jsonData: {}
        };

        return this.backendSrv.post('/api/datasources', dsInstance);
      }

      return Promise.resolve();
    });
  }
}

