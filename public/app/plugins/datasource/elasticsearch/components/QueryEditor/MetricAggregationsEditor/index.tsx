import React from 'react';

import { useDispatch } from '../../../hooks/useStatelessReducer';
import { IconButton } from '../../IconButton';
import { useQuery } from '../ElasticsearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';

import { MetricEditor } from './MetricEditor';
import { MetricAggregation } from './aggregations';
import { addMetric, removeMetric, toggleMetricVisibility } from './state/actions';
import { metricAggregationConfig } from './utils';

interface Props {
  nextId: MetricAggregation['id'];
}

export const MetricAggregationsEditor = ({ nextId }: Props) => {
  const dispatch = useDispatch();
  const { metrics } = useQuery();
  const totalMetrics = metrics?.length || 0;

  return (
    <>
      {metrics?.map((metric, index) => (
        <QueryEditorRow
          key={`${metric.type}-${metric.id}`}
          label={`Metric (${metric.id})`}
          hidden={metric.hide}
          onHideClick={() => dispatch(toggleMetricVisibility(metric.id))}
          onRemoveClick={totalMetrics > 1 && (() => dispatch(removeMetric(metric.id)))}
        >
          <MetricEditor value={metric} />

          {!metricAggregationConfig[metric.type].isSingleMetric && index === 0 && (
            <IconButton iconName="plus" onClick={() => dispatch(addMetric(nextId))} label="add" />
          )}
        </QueryEditorRow>
      ))}
    </>
  );
};
