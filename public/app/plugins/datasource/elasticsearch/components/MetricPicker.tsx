import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';
import React, { FunctionComponent } from 'react';
import { MetricAggregation } from './MetricAggregationsEditor/state/types';
import { metricAggregationConfig } from './MetricAggregationsEditor/utils';

interface Props {
  options: MetricAggregation[];
  onChange: (e: SelectableValue<MetricAggregation>) => void;
  className?: string;
  value: string;
}

export const MetricPicker: FunctionComponent<Props> = ({ options, onChange, className, value }) => {
  return (
    <Segment
      className={className}
      options={toOptions(options)}
      onChange={onChange}
      placeholder="Select Metric"
      value={!!value ? toOption(options.find(option => option.id === value)!) : null}
    />
  );
};

const toOption = (metric: MetricAggregation) => ({
  label: describeMetric(metric),
  value: metric,
});

const toOptions = (metrics: MetricAggregation[]): Array<SelectableValue<MetricAggregation>> => metrics.map(toOption);

// This is a very ugly way to describe a metric (by ID)
// Would be nice maybe to have something like `metricType(anotherMetricType(field))`
const describeMetric = (metric: MetricAggregation) => `${metricAggregationConfig[metric.type].label} ${metric.id}`;
