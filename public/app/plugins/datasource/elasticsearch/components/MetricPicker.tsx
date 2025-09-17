import { css, cx } from '@emotion/css';

import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';

import { MetricAggregation } from '../dataquery.gen';
import { describeMetric } from '../utils';

const noWrap = css({
  whiteSpace: 'nowrap',
});

const toOption = (metric: MetricAggregation) => ({
  label: describeMetric(metric),
  value: metric,
});

const toOptions = (metrics: MetricAggregation[]): Array<SelectableValue<MetricAggregation>> => metrics.map(toOption);

interface Props {
  options: MetricAggregation[];
  onChange: (e: SelectableValue<MetricAggregation>) => void;
  className?: string;
  value?: string;
}

export const MetricPicker = ({ options, onChange, className, value }: Props) => {
  const selectedOption = options.find((option) => option.id === value);

  return (
    <Segment
      className={cx(className, noWrap)}
      options={toOptions(options)}
      onChange={onChange}
      placeholder="Select Metric"
      value={!!selectedOption ? toOption(selectedOption) : undefined}
    />
  );
};
