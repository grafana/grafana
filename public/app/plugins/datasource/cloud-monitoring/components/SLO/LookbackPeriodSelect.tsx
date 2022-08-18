import React, { FunctionComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { QueryEditorRow } from '..';
import { SELECT_WIDTH, LOOKBACK_PERIODS } from '../../constants';

export interface Props {
  refId: string;
  onChange: (lookbackPeriod: string) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
  current?: string;
}

export const LookbackPeriodSelect: FunctionComponent<Props> = ({
  refId,
  current,
  templateVariableOptions,
  onChange,
}) => {
  const options = LOOKBACK_PERIODS.map((lp) => ({
    ...lp,
    label: lp.text,
  }));
  if (current && !options.find((op) => op.value === current)) {
    options.push({ label: current, text: current, value: current, hidden: false });
  }
  const visibleOptions = options.filter((lp) => !lp.hidden);

  return (
    <QueryEditorRow label="Lookback period" htmlFor={`${refId}-lookback-period`}>
      <Select
        inputId={`${refId}-lookback-period`}
        width={SELECT_WIDTH}
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
    </QueryEditorRow>
  );
};
