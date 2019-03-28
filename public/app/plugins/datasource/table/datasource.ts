// Libraries
import _ from 'lodash';

// Types
import { DataQueryOptions, SeriesData, DataQueryResponse } from '@grafana/ui/src/types';
import { TableQuery } from './types';

export class TableDatasource {
  data: SeriesData[];

  /** @ngInject */
  constructor(instanceSettings: any) {
    if (instanceSettings.jsonData) {
      this.data = instanceSettings.jsonData.data;
    }

    if (!this.data) {
      this.data = [];
    }
  }

  query(options: DataQueryOptions<TableQuery>): Promise<DataQueryResponse> {
    const queryTargets = options.targets.filter(target => !target.hide);

    if (queryTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    return Promise.resolve({ data: this.data });
  }

  testDatasource() {
    return new Promise((resolve, reject) => {
      resolve({
        status: 'success',
        message: 'Table Data',
      });
    });
  }
}

export default TableDatasource;
