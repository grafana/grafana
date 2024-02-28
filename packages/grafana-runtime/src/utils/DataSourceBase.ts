import { Observable } from 'rxjs';

import {
  DataSourceApi,
  DataSourceInstanceSettings,
  ScopedVars,
  AdHocVariableFilter,
  TestDataSourceResponse,
  DataQueryRequest,
  DataQueryResponse,
} from '@grafana/data';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

/**
 * This class provides generic default implementations for data source plugin methods.
 * Extend this class to implement a data source plugin.
 *
 * @public
 */
export abstract class DataSourceBase<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceApi<TQuery, TOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<TOptions>) {
    super(instanceSettings);
  }

  /**
   * Test & verify datasource settings & connection details (returning TestingStatus)
   *
   * When verification fails - errors specific to the data source should be handled here and converted to
   * a TestingStatus object. Unknown errors and HTTP errors can be re-thrown and will be handled here:
   * public/app/features/datasources/state/actions.ts
   */
  abstract testDatasource(): Promise<TestDataSourceResponse>;

  /**
   * Query for data, and optionally stream results
   */
  abstract query(request: DataQueryRequest<TQuery>): Promise<DataQueryResponse> | Observable<DataQueryResponse>;

  /**
   * Override to apply template variables and adhoc filters.  The result is usually also `TQuery`, but sometimes this can
   * be used to modify the query structure before sending to the backend.
   *
   */
  applyTemplateVariables(query: TQuery, scopedVars: ScopedVars, filters?: AdHocVariableFilter[]): TQuery {
    return query;
  }

  /**
   * Apply template variables for explore
   *
   * @internal
   */
  interpolateVariablesInQueries(queries: TQuery[], scopedVars: ScopedVars, filters?: AdHocVariableFilter[]): TQuery[] {
    return queries.map((q) => this.applyTemplateVariables(q, scopedVars, filters));
  }
}
