import DatasourceSrv from 'app/features/plugins/datasource_srv';
import { GraphiteType } from './types';

export class GraphiteConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/graphite/partials/config.html';
  datasourceSrv: any;
  current: any;
  graphiteTypes: any;

  /** @ngInject */
  constructor($scope: any, datasourceSrv: DatasourceSrv) {
    this.datasourceSrv = datasourceSrv;
    this.current.jsonData = this.current.jsonData || {};
    this.current.jsonData.graphiteVersion = this.current.jsonData.graphiteVersion || '0.9';
    this.current.jsonData.graphiteType = this.current.jsonData.graphiteType || GraphiteType.Default;
    this.autoDetectGraphiteVersion();
    this.graphiteTypes = Object.keys(GraphiteType).map((key: string) => ({
      name: key,
      value: (GraphiteType as any)[key],
    }));
  }

  autoDetectGraphiteVersion() {
    if (!this.current.id) {
      return;
    }

    this.datasourceSrv
      .loadDatasource(this.current.name)
      .then((ds: any) => {
        return ds.getVersion();
      })
      .then((version: any) => {
        if (!version) {
          return;
        }

        this.graphiteVersions.push({ name: version, value: version });
        this.current.jsonData.graphiteVersion = version;
      });
  }

  graphiteVersions = [
    { name: '0.9.x', value: '0.9' },
    { name: '1.0.x', value: '1.0' },
    { name: '1.1.x', value: '1.1' },
  ];
}
