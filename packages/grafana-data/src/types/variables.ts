import { ComponentType } from 'react';
import { Observable } from 'rxjs';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceOptionsType,
  DataSourceQueryType,
  QueryEditorProps,
} from './datasource';
import { DataQuery } from './query';

/**
 * Enum with the different variable support types
 */
export enum VariableSupportType {
  Legacy = 'legacy',
  Standard = 'standard',
  Custom = 'custom',
  Datasource = 'datasource',
}

/**
 * Base class for VariableSupport classes
 */
export abstract class VariableSupportBase<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>,
> {
  abstract getType(): VariableSupportType;

  /**
   * Define this method in the config if you want to pre-populate the editor with a default query.
   */
  getDefaultQuery?(): Partial<TQuery>;
}

/**
 * Extend this class in a data source plugin to use the standard query editor for Query variables
 */
export abstract class StandardVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>,
> extends VariableSupportBase<DSType, TQuery, TOptions> {
  getType(): VariableSupportType {
    return VariableSupportType.Standard;
  }

  abstract toDataQuery(query: StandardVariableQuery): TQuery;
  query?(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse>;
}

/**
 * Extend this class in a data source plugin to use a customized query editor for Query variables
 */
export abstract class CustomVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  VariableQuery extends DataQuery = any,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>,
> extends VariableSupportBase<DSType, TQuery, TOptions> {
  getType(): VariableSupportType {
    return VariableSupportType.Custom;
  }

  abstract editor: ComponentType<QueryEditorProps<DSType, TQuery, TOptions, VariableQuery>>;

  /**
   * This can return data in various formats as DataQueryResponse allows multiple types. In general though the
   * assumption is that there will be a string Field or value in an Array of objects that will be taken as the possible
   * variable values. You can also use this type directly MetricFindValue or just use text/value/expendable fields/keys
   * in the response.
   * @param request
   */
  abstract query(request: DataQueryRequest<VariableQuery>): Observable<DataQueryResponse>;
}

/**
 * Extend this class in a data source plugin to use the query editor in the data source plugin for Query variables
 */
export abstract class DataSourceVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>,
> extends VariableSupportBase<DSType, TQuery, TOptions> {
  getType(): VariableSupportType {
    return VariableSupportType.Datasource;
  }
}

/**
 * Defines the standard DatQuery used by data source plugins that implement StandardVariableSupport
 */
export interface StandardVariableQuery extends DataQuery {
  query: string;
}
