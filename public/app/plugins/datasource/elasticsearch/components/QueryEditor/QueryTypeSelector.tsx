import React from 'react';

import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import { useDispatch } from '../../hooks/useStatelessReducer';
import { MetricAggregation } from '../../types';

import { useQuery } from './ElasticsearchQueryContext';
import { changeMetricType } from './MetricAggregationsEditor/state/actions';

type QueryType = 'metrics' | 'logs' | 'raw_data' | 'raw_document';

const OPTIONS: Array<SelectableValue<QueryType>> = [
  { value: 'metrics', label: 'Metrics' },
  { value: 'logs', label: 'Logs' },
  { value: 'raw_data', label: 'Raw Data' },
  { value: 'raw_document', label: 'Raw Document' },
];

function metricTypeToQueryType(type: MetricAggregation['type']): QueryType {
  switch (type) {
    case 'logs':
    case 'raw_data':
    case 'raw_document':
      return type;
    default:
      return 'metrics';
  }
}

function queryTypeToMetricType(type: QueryType): MetricAggregation['type'] {
  switch (type) {
    case 'logs':
    case 'raw_data':
    case 'raw_document':
      return type;
    case 'metrics':
      return 'count';
    default:
      // should never happen
      throw new Error(`invalid query type: ${type}`);
  }
}

export const QueryTypeSelector = () => {
  const query = useQuery();
  const dispatch = useDispatch();

  const firstMetric = query.metrics?.[0];

  if (firstMetric == null) {
    // not sure if this can really happen, but we should handle it anyway
    return null;
  }

  const queryType = metricTypeToQueryType(firstMetric.type);

  const onChange = (newQueryType: QueryType) => {
    dispatch(changeMetricType({ id: firstMetric.id, type: queryTypeToMetricType(newQueryType) }));
  };

  return <RadioButtonGroup<QueryType> fullWidth={false} options={OPTIONS} value={queryType} onChange={onChange} />;
};
