import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, Select } from '@grafana/ui';

import { LOOKBACK_PERIODS } from '../../constants';

export interface Props {
  refId: string;
  onChange: (lookbackPeriod: string) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
  current?: string;
}

export const LookbackPeriodSelect = ({ refId, current, templateVariableOptions, onChange }: Props) => {
  const options = LOOKBACK_PERIODS.map((lp) => ({
    ...lp,
    label: lp.text,
  }));
  if (current && !options.find((op) => op.value === current)) {
    options.push({ label: current, text: current, value: current, hidden: false });
  }
  const visibleOptions = options.filter((lp) => !lp.hidden);

  return (
    <EditorField label="Lookback period" htmlFor={`${refId}-lookback-period`}>
      <Select
        inputId={`${refId}-lookback-period`}
        width="auto"
        allowCustomValue
        value={[...options, ...templateVariableOptions].find((s) => s.value === current)}
        options={[
          {
            label: 'Template Variables',
            options: templateVariableOptions,
          },
          {
            label: 'Predefined periods',
            expanded: true,
            options: visibleOptions,
          },
        ]}
        onChange={({ value }) => onChange(value!)}
      />
    </EditorField>
  );
};
