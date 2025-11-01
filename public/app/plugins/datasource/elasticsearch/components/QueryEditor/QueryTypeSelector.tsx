import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import { useDispatch } from '../../hooks/useStatelessReducer';
import { queryTypeToMetricType } from '../../queryDef';
import { QueryType } from '../../types';

import { useQuery } from './ElasticsearchQueryContext';
import { changeMetricType } from './MetricAggregationsEditor/state/actions';
import { metricAggregationConfig } from './MetricAggregationsEditor/utils';

export const OPTIONS: Array<SelectableValue<QueryType>> = [
  { value: 'metrics', label: 'Metrics' },
  { value: 'logs', label: 'Logs' },
  { value: 'raw_data', label: 'Raw Data' },
  { value: 'raw_document', label: 'Raw Document' },
];

export const QueryTypeSelector = () => {
  const query = useQuery();
  const dispatch = useDispatch();

  const firstMetric = query.metrics?.[0];

  if (firstMetric == null) {
    // not sure if this can really happen, but we should handle it anyway
    return null;
  }

  const queryType = metricAggregationConfig[firstMetric.type].impliedQueryType;

  const onChange = (newQueryType: QueryType) => {
    dispatch(changeMetricType({ id: firstMetric.id, type: queryTypeToMetricType(newQueryType) }));
  };

  return <RadioButtonGroup<QueryType> fullWidth={false} options={OPTIONS} value={queryType} onChange={onChange} />;
};
