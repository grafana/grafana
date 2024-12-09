import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';

import { getAggregationOptionsByMetric } from '../functions';
import { ValueTypes } from '../types/query';
import { MetricDescriptor } from '../types/types';

export interface Props {
  refId: string;
  onChange: (metricDescriptor: string) => void;
  metricDescriptor?: MetricDescriptor;
  crossSeriesReducer: string;
  groupBys: string[];
  templateVariableOptions: Array<SelectableValue<string>>;
}

export const Aggregation = (props: Props) => {
  const aggOptions = useAggregationOptionsByMetric(props);
  const selected = useSelectedFromOptions(aggOptions, props);

  return (
    <EditorField
      label="Group by function"
      data-testid="cloud-monitoring-aggregation"
      tooltip={
        'Aggregation function used on the metric data. Defaults to none for scalar data and mean for distribution data. Not applying an aggregation to distribution data may lead to performance issues.'
      }
    >
      <Select
        width="auto"
        onChange={({ value }) => props.onChange(value!)}
        value={selected}
        options={[
          {
            label: 'Template Variables',
            options: props.templateVariableOptions,
          },
          {
            label: 'Aggregations',
            expanded: true,
            options: aggOptions,
          },
        ]}
        placeholder="Select Reducer"
        inputId={`${props.refId}-group-by-function`}
        menuPlacement="top"
      />
    </EditorField>
  );
};

const useAggregationOptionsByMetric = ({ metricDescriptor }: Props): Array<SelectableValue<string>> => {
  const valueType = metricDescriptor?.valueType;
  const metricKind = metricDescriptor?.metricKind;

  return useMemo(() => {
    if (!valueType || !metricKind) {
      return [];
    }

    return getAggregationOptionsByMetric(valueType as ValueTypes, metricKind).map((a) => ({
      ...a,
      label: a.text,
    }));
  }, [valueType, metricKind]);
};

const useSelectedFromOptions = (aggOptions: Array<SelectableValue<string>>, props: Props) => {
  return useMemo(() => {
    const allOptions = [...aggOptions, ...props.templateVariableOptions];
    return allOptions.find((s) => s.value === props.crossSeriesReducer);
  }, [aggOptions, props.crossSeriesReducer, props.templateVariableOptions]);
};
