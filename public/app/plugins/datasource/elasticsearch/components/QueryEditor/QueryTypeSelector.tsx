import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { RadioButtonGroup } from '@grafana/ui';

import { MetricAggregation } from '../../dataquery.gen';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { QueryType } from '../../types';

import { useQuery } from './ElasticsearchQueryContext';
import { changeMetricType } from './MetricAggregationsEditor/state/actions';
import { metricAggregationConfig } from './MetricAggregationsEditor/utils';

const BASE_OPTIONS: Array<SelectableValue<QueryType>> = [
  { value: 'metrics', label: 'Metrics' },
  { value: 'logs', label: 'Logs' },
  { value: 'raw_data', label: 'Raw Data' },
  { value: 'raw_document', label: 'Raw Document' },
];

const RAW_DSL_OPTION: SelectableValue<QueryType> = { value: 'raw_dsl', label: 'Raw Query DSL' };

function getOptions(): Array<SelectableValue<QueryType>> {
  if (config.featureToggles.elasticsearchRawDSLQuery) {
    return [...BASE_OPTIONS, RAW_DSL_OPTION];
  }
  return BASE_OPTIONS;
}

function queryTypeToMetricType(type: QueryType): MetricAggregation['type'] {
  switch (type) {
    case 'logs':
    case 'raw_data':
    case 'raw_document':
    case 'raw_dsl':
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

  const queryType = metricAggregationConfig[firstMetric.type].impliedQueryType;

  const onChange = (newQueryType: QueryType) => {
    dispatch(changeMetricType({ id: firstMetric.id, type: queryTypeToMetricType(newQueryType) }));
  };

  return <RadioButtonGroup<QueryType> fullWidth={false} options={getOptions()} value={queryType} onChange={onChange} />;
};
