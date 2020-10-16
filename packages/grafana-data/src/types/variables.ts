import { ComponentType } from 'react';
import { Observable } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceOptionsType,
  DataSourceQueryType,
  QueryEditorProps,
} from './datasource';

export interface VariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>,
  VariableQuery extends DataQuery = any
> {
  default?: {
    toDataQuery: (query: VariableQuery) => TQuery;
    query?: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
  };
  custom?: {
    editor: ComponentType<QueryEditorProps<DSType, TQuery, TOptions, VariableQuery>>;
    query: (request: DataQueryRequest<VariableQuery>) => Observable<DataQueryResponse>;
  };
  datasource?: {
    editor: ComponentType<QueryEditorProps<DSType, TQuery, TOptions, TQuery>>;
  };
}

export interface DefaultVariableQuery extends DataQuery {
  query: string;
}
