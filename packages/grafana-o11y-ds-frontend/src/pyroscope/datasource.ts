import { Observable } from 'rxjs';

import { CoreApp, DataQueryRequest, DataQueryResponse, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { PyroscopeDataSourceOptions, ProfileTypeMessage, Query } from './types';

export abstract class PyroscopeDataSource extends DataSourceWithBackend<Query, PyroscopeDataSourceOptions> {
  abstract applyTemplateVariables(query: Query, scopedVars: ScopedVars): Query;
  abstract getDefaultQuery(app: CoreApp): Partial<Query>;
  abstract getProfileTypes(): Promise<ProfileTypeMessage[]>;
  abstract query(request: DataQueryRequest<Query>): Observable<DataQueryResponse>;
}
