import React, { FunctionComponent } from 'react';
import { InlineFieldRow } from '@grafana/ui';
import { metricAggregationConfig } from '../../query_def';
import { AddRemove } from '../AddRemove';
import { useElasticsearchQuery } from '../ElasticsearchQueryContext';
import { MetricEditor } from './MetricEditor';

export const MetricAggregationsEditor: FunctionComponent = () => {
  const { query, addMetric, removeMetric, changeMetric } = useElasticsearchQuery();

  return (
    <>
      {query.metrics.map((metric, index) => (
        <InlineFieldRow key={metric.id}>
          <MetricEditor metric={metric} onChange={changeMetric(index)} />

          {!metricAggregationConfig[metric.type].isSingleMetric && (
            <AddRemove index={index} elements={query.metrics} onAdd={addMetric} onRemove={removeMetric} />
          )}
        </InlineFieldRow>
      ))}
    </>
  );
};
