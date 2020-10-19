import React, { FunctionComponent } from 'react';
import { InlineFieldRow } from '@grafana/ui';
import { AddRemove } from '../AddRemove';
import { MetricEditor } from './MetricEditor';
import { useDispatch } from '../ElasticsearchQueryContext';
import { MetricAggregation, MetricAggregationAction } from './state/types';
import { metricAggregationConfig } from './utils';
import { addMetric, removeMetric } from './state/actions';

interface Props {
  value: MetricAggregation[];
}

export const MetricAggregationsEditor: FunctionComponent<Props> = ({ value }) => {
  const dispatch = useDispatch<MetricAggregationAction>();

  return (
    <>
      {JSON.stringify(value, null, 2)}

      {value.map((metric, index) => (
        <InlineFieldRow key={metric.id}>
          <MetricEditor value={metric} />

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
