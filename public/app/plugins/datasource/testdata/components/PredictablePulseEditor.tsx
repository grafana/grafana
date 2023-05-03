import React, { ChangeEvent } from 'react';

import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';
import { PulseWaveQuery } from '../dataquery.gen';

const fields: Array<{
  label: string;
  id: keyof PulseWaveQuery;
  placeholder: string;
  tooltip: string;
}> = [
  { label: 'Step', id: 'timeStep', placeholder: '60', tooltip: 'The number of seconds between datapoints.' },
  {
    label: 'On Count',
    id: 'onCount',
    placeholder: '3',
    tooltip: 'The number of values within a cycle, at the start of the cycle, that should have the onValue.',
  },
  { label: 'Off Count', id: 'offCount', placeholder: '6', tooltip: 'The number of offValues within the cycle.' },
  {
    label: 'On Value',
    id: 'onValue',
    placeholder: '1',
    tooltip: 'The value for "on values", may be an int, float, or null.',
  },
  {
    label: 'Off Value',
    id: 'offValue',
    placeholder: '1',
    tooltip: 'The value for "off values", may be a int, float, or null.',
  },
];

export const PredictablePulseEditor = ({ onChange, query }: EditorProps) => {
  // Convert values to numbers before saving
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    onChange({ target: { name, value: Number(value) } });
  };

  return (
    <InlineFieldRow>
      {fields.map(({ label, id, placeholder, tooltip }) => {
        return (
          <InlineField label={label} labelWidth={14} key={id} tooltip={tooltip}>
            <Input
              width={32}
              type="number"
              name={id}
              id={`pulseWave.${id}-${query.refId}`}
              value={query.pulseWave?.[id]}
              placeholder={placeholder}
              onChange={onInputChange}
            />
          </InlineField>
        );
      })}
    </InlineFieldRow>
  );
};
