import React, { FunctionComponent } from 'react';
import { css, cx } from 'emotion';
import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { MetricAggregation } from './MetricAggregationsEditor/state/types';
import { metricAggregationConfig } from './MetricAggregationsEditor/utils';

const noWrap = css`
  white-space: nowrap;
`;

const describeMetric = (metric: MetricAggregation) => `${metricAggregationConfig[metric.type].label} ${metric.id}`;

const toOption = (metric: MetricAggregation) => ({
  label: describeMetric(metric),
  value: metric,
});

const toOptions = (metrics: MetricAggregation[]): Array<SelectableValue<MetricAggregation>> => metrics.map(toOption);

interface Props {
  options: MetricAggregation[];
  onChange: (e: SelectableValue<MetricAggregation>) => void;
  className?: string;
  value: string;
}

export const MetricPicker: FunctionComponent<Props> = ({ options, onChange, className, value }) => (
  <Segment
    className={cx(className, noWrap)}
    options={toOptions(options)}
    onChange={onChange}
    placeholder="Select Metric"
    value={!!value ? toOption(options.find(option => option.id === value)!) : null}
  />
);
