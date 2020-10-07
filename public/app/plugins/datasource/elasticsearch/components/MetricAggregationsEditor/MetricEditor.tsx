import { SelectableValue } from '@grafana/data';
import { InlineField, Segment, SegmentAsync, useTheme } from '@grafana/ui';
import { cx } from 'emotion';
import React, { FunctionComponent } from 'react';
import { useDatasource, useDispatch, useQuery } from '../ElasticsearchQueryContext';
import { getStyles } from './styles';
import { marginZero } from '../styles';
import { MetricAggregation, MetricAggregationAction, MetricAggregationType } from '../../state/metricAggregation/types';
import { metricAggregationConfig } from '../../state/metricAggregation/utils';
import { changeMetricField, changeMetricType, toggleMetricVisibility } from '../../state/metricAggregation/actions';
import { ToggleVisibilityButton } from '../ToggleVisibilityButton';

const toOption = (metric: MetricAggregation) => ({
  label: metricAggregationConfig[metric.type].label,
  value: metric.type,
});

interface Props {
  value: MetricAggregation;
}

// If a metric is a Pipeline Aggregation (https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-pipeline.html)
// it doesn't make sense to show it in the type picker when there is no non-pipeline-aggregation previously selected
// as they work on the outputs produced from other aggregations rather than from document sets.
// This means we should filter them out from the type picker if there's no other "basic" aggregation before the current one.
const isBasicAggregation = (metric: MetricAggregation) =>
  metric.type !== 'count' && !metricAggregationConfig[metric.type].isPipelineAgg;

const getTypeOptions = (
  previousMetrics: MetricAggregation[],
  minEsVersion: number
): Array<SelectableValue<MetricAggregationType>> => {
  // we'll include Pipeline Aggeregations only if at least one previous metric is a "Basic" one
  const includePipelineAggregations = previousMetrics.some(isBasicAggregation);

  return (
    Object.entries(metricAggregationConfig)
      // Only showing metrics type supported by the configured version of ES
      .filter(([_, { minVersion }]) => !minVersion || minEsVersion >= minVersion)
      // Filtering out Pipeline Aggragations if there's no basic metric selected before
      .filter(([_, config]) => includePipelineAggregations || !config.isPipelineAgg)
      .map(([key, { label }]) => ({
        label,
        value: key as MetricAggregationType,
      }))
  );
};

export const MetricEditor: FunctionComponent<Props> = ({ value }) => {
  const styles = getStyles(useTheme(), value.hide);
  const datasource = useDatasource();
  const query = useQuery();
  const dispatch = useDispatch<MetricAggregationAction>();

  const previousMetrics = query.metrics!.slice(
    0,
    query.metrics!.findIndex(m => m.id === value.id)
  );

  const getFields = () => {
    if (value.type === 'cardinality') {
      return datasource.getFields();
    }
    return datasource.getFields('number');
  };

  return (
    <>
      <InlineField label="Metric" labelWidth={15} className={cx(styles.color)}>
        <Segment
          className={cx(styles.color, marginZero)}
          // FIXME: This needs to be filtered by esVersion
          options={getTypeOptions(previousMetrics, datasource.esVersion)}
          onChange={e => dispatch(changeMetricType(value.id, e.value!))}
          value={toOption(value)}
        />
      </InlineField>

      {metricAggregationConfig[value.type].requiresField && (
        <SegmentAsync
          className={cx(styles.color)}
          loadOptions={getFields}
          onChange={e => dispatch(changeMetricField(value.id, e.value!))}
          placeholder="Select Metric"
          value={value.field}
        />
      )}

      {metricAggregationConfig[value.type].isPipelineAgg &&
        !metricAggregationConfig[value.type].supportsMultipleBucketPaths && (
          <Segment
            className={cx(styles.color)}
            options={metricsToOptions(previousMetrics)}
            onChange={e => dispatch(changeMetricField(value.id, e.value?.id!))}
            placeholder="Select Metric"
            value={value.field ? metricToOption(previousMetrics.find(p => p.id === value.field)!) : null}
          />
        )}

      <ToggleVisibilityButton onClick={() => dispatch(toggleMetricVisibility(value.id))} hide={value.hide} />
    </>
  );
};

const metricToOption = (metric: MetricAggregation) => ({
  label: describeMetric(metric),
  value: metric,
});

const metricsToOptions = (metrics: MetricAggregation[]): Array<SelectableValue<MetricAggregation>> =>
  metrics.map(metricToOption);

const describeMetric = (metric: MetricAggregation) => `${metric.type} ${metric.field}`;
