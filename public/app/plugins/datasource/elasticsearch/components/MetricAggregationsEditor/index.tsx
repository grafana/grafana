import React, { FunctionComponent } from 'react';
import { InlineFieldRow } from '@grafana/ui';
import { defaultMetricAgg, metricAggregationConfig } from '../../query_def';
import { AddRemove } from '../AddRemove';
import { MetricEditor } from './MetricEditor';
import { MetricAggregation, MetricAggregationAction } from '../../state/metricAggregation/types';
import { useDispatch } from '../ElasticsearchQueryContext';
import { addMetric, removeMetric } from '../../state/metricAggregation/actions';

interface Props {
  value?: MetricAggregation[];
}

export const MetricAggregationsEditor: FunctionComponent<Props> = ({ value = [defaultMetricAgg()] }) => {
  const dispatch = useDispatch<MetricAggregationAction>();

  return (
    <>
      {value.map((metric, index) => (
        <InlineFieldRow key={metric.id}>
          <MetricEditor metric={metric} />

          {!metricAggregationConfig[metric.type].isSingleMetric && (
            <AddRemove
              index={index}
              elements={value}
              onAdd={() => dispatch(addMetric('count'))}
              onRemove={() => dispatch(removeMetric(metric.id))}
            />
          )}
        </InlineFieldRow>
      ))}
    </>
  );
};
