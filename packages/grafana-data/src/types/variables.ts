import { OperatorFunction } from 'rxjs';

import { DataQuery, DataQueryRequest, MetricFindValue } from './datasource';
import { DataFrame } from './dataFrame';
import { ScopedVars } from './ScopedVars';

export interface VariableSupport<TQuery extends DataQuery = DataQuery> {
  /**
   * Defines how to transform the query provided from the variable into the DataQueryRequest used to query for MetricFindValues.
   */
  toDataQueryRequest: (query: string | any, scopedVars: ScopedVars) => DataQueryRequest;

  /**
   * Defines how to transform data frames into metric find values used by variable.
   */
  toMetricFindValues: () => OperatorFunction<DataFrame[], MetricFindValue[]>;
}
