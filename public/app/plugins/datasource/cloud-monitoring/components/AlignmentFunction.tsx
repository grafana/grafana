import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { getAlignmentPickerData } from '../functions';
import { PreprocessorType, SLOQuery, TimeSeriesList } from '../types/query';
import { MetricDescriptor } from '../types/types';

export interface Props {
  inputId: string;
  onChange: (query: TimeSeriesList | SLOQuery) => void;
  query: TimeSeriesList | SLOQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
  metricDescriptor?: MetricDescriptor;
  preprocessor?: PreprocessorType;
}

export const AlignmentFunction = ({
  inputId,
  query,
  templateVariableOptions,
  onChange,
  metricDescriptor,
  preprocessor,
}: Props) => {
  const { perSeriesAligner: psa } = query;
  let { valueType, metricKind } = metricDescriptor || {};

  const { perSeriesAligner, alignOptions } = useMemo(
    () => getAlignmentPickerData(valueType, metricKind, psa, preprocessor),
    [valueType, metricKind, psa, preprocessor]
  );

  return (
    <Select
      onChange={({ value }) => onChange({ ...query, perSeriesAligner: value! })}
      value={[...alignOptions, ...templateVariableOptions].find((s) => s.value === perSeriesAligner)}
      options={[
        {
          label: 'Template Variables',
          options: templateVariableOptions,
        },
        {
          label: 'Alignment options',
          expanded: true,
          options: alignOptions,
        },
      ]}
      placeholder="Select Alignment"
      inputId={inputId}
      menuPlacement="top"
    />
  );
};
