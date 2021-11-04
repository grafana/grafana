import React, { FC, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { MetricQuery } from '../types';
import { getAlignmentPickerData } from '../functions';
import { SELECT_WIDTH } from '../constants';

export interface Props {
  onChange: (query: MetricQuery) => void;
  query: MetricQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
}

export const AlignmentFunction: FC<Props> = ({ query, templateVariableOptions, onChange }) => {
  const { valueType, metricKind, perSeriesAligner: psa, preprocessor } = query;
  const { perSeriesAligner, alignOptions } = useMemo(
    () => getAlignmentPickerData(valueType, metricKind, psa, preprocessor),
    [valueType, metricKind, psa, preprocessor]
  );

  return (
    <Select
      menuShouldPortal
      width={SELECT_WIDTH}
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
    ></Select>
  );
};
