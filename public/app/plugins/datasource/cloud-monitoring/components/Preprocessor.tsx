import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { RadioButtonGroup } from '@grafana/ui';

import { getAlignmentPickerData } from '../functions';
import { PreprocessorType, TimeSeriesList, MetricKind, ValueTypes } from '../types/query';
import { MetricDescriptor } from '../types/types';

const NONE_OPTION = { label: 'None', value: PreprocessorType.None };

export interface Props {
  metricDescriptor?: MetricDescriptor;
  onChange: (query: TimeSeriesList) => void;
  query: TimeSeriesList;
}

export const Preprocessor = ({ query, metricDescriptor, onChange }: Props) => {
  const options = useOptions(metricDescriptor);

  return (
    <EditorField
      label="Pre-processing"
      tooltip="Preprocessing options are displayed when the selected metric has a metric kind of delta or cumulative. The specific options available are determined by the metric's value type. If you select 'Rate', data points are aligned and converted to a rate per time series. If you select 'Delta', data points are aligned by their delta (difference) per time series"
    >
      <RadioButtonGroup
        onChange={(value: PreprocessorType) => {
          const { perSeriesAligner: psa } = query;
          const { valueType, metricKind } = metricDescriptor ?? {};
          const { perSeriesAligner } = getAlignmentPickerData(valueType, metricKind, psa, value);
          onChange({ ...query, preprocessor: value, perSeriesAligner });
        }}
        value={query.preprocessor ?? PreprocessorType.None}
        options={options}
      />
    </EditorField>
  );
};

const useOptions = (metricDescriptor?: MetricDescriptor): Array<SelectableValue<PreprocessorType>> => {
  const metricKind = metricDescriptor?.metricKind;
  const valueType = metricDescriptor?.valueType;

  return useMemo(() => {
    if (!metricKind || metricKind === MetricKind.GAUGE || valueType === ValueTypes.DISTRIBUTION) {
      return [NONE_OPTION];
    }

    const options = [
      NONE_OPTION,
      {
        label: 'Rate',
        value: PreprocessorType.Rate,
        description: 'Data points are aligned and converted to a rate per time series',
      },
    ];

    return metricKind === MetricKind.CUMULATIVE
      ? [
          ...options,
          {
            label: 'Delta',
            value: PreprocessorType.Delta,
            description: 'Data points are aligned by their delta (difference) per time series',
          },
        ]
      : options;
  }, [metricKind, valueType]);
};
