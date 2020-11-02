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

export type VariableSupportType = 'standard' | 'custom' | 'datasource';

/**
 * Implement this interface in a data source plugin to use the standard query editor for Query variables
 *
 * @alpha -- experimental
 */
export interface StandardVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> {
  type: VariableSupportType;
  toDataQuery: (query: StandardVariableQuery) => TQuery;
  query?: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
}

/**
 * Implement this interface in a data source plugin to use a customized query editor for Query variables
 *
 * @alpha -- experimental
 */
export interface CustomVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  VariableQuery extends DataQuery = any,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> {
  type: VariableSupportType;
  editor: ComponentType<QueryEditorProps<DSType, TQuery, TOptions, VariableQuery>>;
  query: (request: DataQueryRequest<VariableQuery>) => Observable<DataQueryResponse>;
}

/**
 * Implement this interface in a data source plugin to use the query editor in the data source plugin for Query variables
 *
 * @alpha -- experimental
 */
export interface DataSourceVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> {
  type: VariableSupportType;
}

/**
 * Defines the standard DatQuery used by data source plugins that implement StandardVariableSupport
 *
 * @alpha -- experimental
 */
export interface StandardVariableQuery extends DataQuery {
  query: string;
}
