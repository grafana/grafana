import { Observable, of } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { ParcaDataSourceOptions, Query, ProfileTypeMessage } from './types';

export class ParcaDataSource extends DataSourceWithBackend<Query, ParcaDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<ParcaDataSourceOptions>) {
    super(instanceSettings);
  }

  query(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    if (!request.targets.every((q) => q.profileTypeId)) {
      // When changing data source in explore, firs query can be sent without filled in profileTypeId
      return of({ data: [] });
    }

    return super.query(request);
  }

  async getProfileTypes(): Promise<ProfileTypeMessage[]> {
    return await super.getResource('profileTypes');
  }

  async getLabelNames(): Promise<string[]> {
    return await super.getResource('labelNames');
  }

  async getLabelValues(labelName: string): Promise<string[]> {
    return await super.getResource('labelValues', { label: labelName });
  }
}
