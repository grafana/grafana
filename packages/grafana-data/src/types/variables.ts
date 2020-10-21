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

/**
 * Defines new variable support
 *
 * Use one of the properties standard | custom | datasource to define the kind of query editor and query support you want to use in the Variable system
 *
 * @experimental
 */
export interface VariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>,
  VariableQuery extends DataQuery = any
> {
  /**
   * Use this property if you want to use the standard query editor supplied in the Variable system
   */
  standard?: StandardVariableSupport<DSType, TQuery, TOptions>;

  /**
   * Use this property if you want to use a custom query and query editor
   */
  custom?: CustomVariableSupport<DSType, VariableQuery, TQuery, TOptions>;

  /**
   * Use this property if you want to use the same query editor as the data source
   */
  datasource?: DataSourceVariableSupport<DSType, TQuery, TOptions>;
}

export interface StandardVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> {
  toDataQuery: (query: StandardVariableQuery) => TQuery;
  query?: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
}

export interface CustomVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  VariableQuery extends DataQuery = any,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> {
  editor: ComponentType<QueryEditorProps<DSType, TQuery, TOptions, VariableQuery>>;
  query: (request: DataQueryRequest<VariableQuery>) => Observable<DataQueryResponse>;
}

export interface DataSourceVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> {
  editor: ComponentType<QueryEditorProps<DSType, TQuery, TOptions, TQuery>>;
}

export interface StandardVariableQuery extends DataQuery {
  query: string;
}
