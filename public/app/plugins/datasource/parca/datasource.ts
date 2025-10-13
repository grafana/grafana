import { Observable, of } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { ParcaDataSourceOptions, Query, ProfileTypeMessage } from './types';

export class ParcaDataSource extends DataSourceWithBackend<Query, ParcaDataSourceOptions> {
  constructor(
    instanceSettings: DataSourceInstanceSettings<ParcaDataSourceOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
  }

  query(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    if (!request.targets.every((q) => q.profileTypeId)) {
      // When changing data source in explore, firs query can be sent without filled in profileTypeId
      return of({ data: [] });
    }

    return super.query(request);
  }

  applyTemplateVariables(query: Query, scopedVars: ScopedVars): Query {
    return {
      ...query,
      labelSelector: this.templateSrv.replace(query.labelSelector ?? '', scopedVars),
    };
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
