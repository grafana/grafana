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
 *
 * @alpha -- experimental
 */
export enum VariableSupportType {
  Legacy = 'legacy',
  Standard = 'standard',
  Custom = 'custom',
  Datasource = 'datasource',
}

/**
 * Base class for VariableSupport classes
 *
 * @alpha -- experimental
 */
export abstract class VariableSupportBase<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> {
  abstract getType(): VariableSupportType;

  /**
   * Define this method in the config if you want to pre-populate the editor with a default query.
   */
  getDefaultQuery?(): Partial<TQuery>;
}

/**
 * Extend this class in a data source plugin to use the standard query editor for Query variables
 *
 * @alpha -- experimental
 */
export abstract class StandardVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> extends VariableSupportBase<DSType, TQuery, TOptions> {
  getType(): VariableSupportType {
    return VariableSupportType.Standard;
  }

  abstract toDataQuery(query: StandardVariableQuery): TQuery;
  query?(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse>;
}

/**
 * Extend this class in a data source plugin to use a customized query editor for Query variables
 *
 * @alpha -- experimental
 */
export abstract class CustomVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  VariableQuery extends DataQuery = any,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> extends VariableSupportBase<DSType, TQuery, TOptions> {
  getType(): VariableSupportType {
    return VariableSupportType.Custom;
  }

  abstract editor: ComponentType<QueryEditorProps<DSType, TQuery, TOptions, VariableQuery>>;
  abstract query(request: DataQueryRequest<VariableQuery>): Observable<DataQueryResponse>;
}

/**
 * Extend this class in a data source plugin to use the query editor in the data source plugin for Query variables
 *
 * @alpha -- experimental
 */
export abstract class DataSourceVariableSupport<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>
> extends VariableSupportBase<DSType, TQuery, TOptions> {
  getType(): VariableSupportType {
    return VariableSupportType.Datasource;
  }
}

/**
 * Defines the standard DatQuery used by data source plugins that implement StandardVariableSupport
 *
 * @alpha -- experimental
 */
export interface StandardVariableQuery extends DataQuery {
  query: string;
}
