import { SelectableValue } from '@grafana/data';

import {
  GetMetricHistoryQuery,
  GetMetricValueQuery,
  QueryType,
  AggregateType,
  GetMetricAggregateQuery,
  OrderDirection,
  GetQuery,
  TypedQuery,
  OperatorType,
  GetMetricTableQuery
} from './types';

export interface QueryTypeInfo extends SelectableValue<QueryType> {
  value: QueryType; // not optional
  defaultQuery: Partial<TypedQuery>;
};

export const queryTypeInfos: QueryTypeInfo[] = [
  {
    label: 'Get metric history',
    value: QueryType.GetMetricHistory,
    description: `Gets the history of a metric.`,
    defaultQuery: {} as GetMetricHistoryQuery,
  },
  {
    label: 'Get metric value',
    value: QueryType.GetMetricValue,
    description: `Gets the last value of a metric.`,
    defaultQuery: {} as GetMetricValueQuery,
  },
  {
    label: 'Get metric aggregate',
    value: QueryType.GetMetricAggregate,
    description: `Gets the aggregation(s) of metric(s).`,
    defaultQuery: {} as GetMetricAggregateQuery,
  },
  {
    label: 'Get metric table',
    value: QueryType.GetMetricTable,
    description: `Gets the table of metric(s).`,
    defaultQuery: {} as GetMetricTableQuery,
  }
];

export function changeQueryType(q: TypedQuery, info: QueryTypeInfo): TypedQuery {
  if (q.queryType === info.value) {
    return q; // no change;
  }
  return {
    ...info.defaultQuery,
    ...q,
    queryType: info.value
  };
};

export interface OperatorTypeInfo extends SelectableValue<OperatorType> {
  value: OperatorType; // not optional
};

export const operatorTypeInfos: OperatorTypeInfo[] = [
  {
    label: '=',
    value: OperatorType.Equals,
    description: `Equals.`
  },
  {
    label: '!=',
    value: OperatorType.NotEquals,
    description: `Not equals.`
  },
  {
    label: '<',
    value: OperatorType.LessThan,
    description: `Less than.`
  },
  {
    label: '<=',
    value: OperatorType.LessThanOrEqual,
    description: `Less than or equal.`
  },
  {
    label: '>',
    value: OperatorType.GreaterThan,
    description: `Greater than.`
  },
  {
    label: '>=',
    value: OperatorType.GreaterThanOrEqual,
    description: `Greater than or equal.`
  },
  {
    label: 'LIKE',
    value: OperatorType.Like,
    description: `Like.`
  },
  {
    label: 'NOT LIKE',
    value: OperatorType.NotLike,
    description: `Not Like.`
  },
  {
    label: 'IN',
    value: OperatorType.In,
    description: `In.`
  },
  {
    label: 'NOT IN',
    value: OperatorType.NotIn,
    description: `Not In.`
  }
];

export interface AggregateInfo extends SelectableValue<AggregateType> {
  value: AggregateType; // not optional
};

export const aggregateInfos: AggregateInfo[] = [
  {
    label: 'Sum',
    value: AggregateType.Sum,
    description: `Gets the sum.`
  },
  {
    label: 'Average',
    value: AggregateType.Avg,
    description: `Gets the average.`
  },
  {
    label: 'Ratio of Sums',
    value: AggregateType.RatioOfSums,
    description: `Gets the ratio between two sums.`
  },
  {
    label: 'Count',
    value: AggregateType.Count,
    description: `Gets the count.`
  }
];

export const numberOfFieldsForAggregateType: Map<AggregateType, number> = new Map([
  [ AggregateType.Sum, 1 ],
  [ AggregateType.Avg, 1 ],
  [ AggregateType.RatioOfSums, 2 ],
  [ AggregateType.Count, 1 ]
]);

export interface OrderDirectionInfo extends SelectableValue<OrderDirection> {
  value: OrderDirection; // not optional
};

export const orderDirectionInfos: OrderDirectionInfo[] = [
  {
    label: 'Asc',
    value: OrderDirection.Asc,
    description: `Ascending order.`
  },
  {
    label: 'Desc',
    value: OrderDirection.Desc,
    description: `Descending order.`
  }
];

export function changeAggregate(q: GetQuery, info: AggregateInfo) {
  return q; // no change;
};