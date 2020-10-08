import { OperatorFunction } from 'rxjs';

import { DataQuery, MetricFindValue } from './datasource';
import { DataFrame } from './dataFrame';

/**
 * Since Grafana 7.3
 *
 * This offers a generic approach to variables processing
 */
export interface VariableSupport<TQuery extends DataQuery = DataQuery> {
  /**
   * Defines how to transform the query provided from the variable into the DataQuery used to query for MetricFindValues.
   */
  toDataQuery: (query: any) => TQuery;

  /**
   * Defines how to transform data frames into metric find values used by variable.
   */
  toMetricFindValues: () => OperatorFunction<DataFrame[], MetricFindValue[]>;
}
