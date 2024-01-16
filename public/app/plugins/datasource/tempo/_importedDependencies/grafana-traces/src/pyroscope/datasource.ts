import { Observable } from 'rxjs';

import { AbstractQuery, CoreApp, DataQueryRequest, DataQueryResponse, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { PyroscopeDataSourceOptions, Query, ProfileTypeMessage } from './types';

export abstract class PyroscopeDataSource extends DataSourceWithBackend<Query, PyroscopeDataSourceOptions> {
  abstract query(request: DataQueryRequest<Query>): Observable<DataQueryResponse>;

  abstract getProfileTypes(): Promise<ProfileTypeMessage[]>;

  abstract getLabelNames(query: string, start: number, end: number): Promise<string[]>;

  abstract getLabelValues(query: string, label: string, start: number, end: number): Promise<string[]>;

  abstract applyTemplateVariables(query: Query, scopedVars: ScopedVars): Query;

  abstract importFromAbstractQueries(abstractQueries: AbstractQuery[]): Promise<Query[]>;

  abstract importFromAbstractQuery(labelBasedQuery: AbstractQuery): Query;

  abstract exportToAbstractQueries(queries: Query[]): Promise<AbstractQuery[]>;

  abstract exportToAbstractQuery(query: Query): AbstractQuery;

  abstract getDefaultQuery(app: CoreApp): Partial<Query>;
}
