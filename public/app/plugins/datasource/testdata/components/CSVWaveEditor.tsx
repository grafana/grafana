import React from 'react';
import { EditorProps } from '../QueryEditor';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

const fields = [
  {
    label: 'Step',
    type: 'number',
    id: 'timeStep',
    placeholder: '60',
    tooltip: 'The number of seconds between datapoints.',
  },
  {
    label: 'CSV Values',
    type: 'text',
    id: 'valuesCSV',
    placeholder: '1,2,3,4',
    tooltip:
      'Comma separated values. Each value may be an int, float, or null and must not be empty. Whitespace and trailing commas are removed.',
  },
];
export const CSVWaveEditor = ({ onChange, query }: EditorProps) => {
  return (
    <InlineFieldRow>
      {fields.map(({ label, id, type, placeholder, tooltip }, index) => {
        const grow = index === fields.length - 1;
        return (
          <InlineField label={label} labelWidth={14} key={id} tooltip={tooltip} grow={grow}>
            <Input
              width={grow ? undefined : 32}
              type={type}
              name={id}
              id={`csvWave.${id}-${query.refId}`}
              value={query.csvWave?.[id]}
              placeholder={placeholder}
              onChange={onChange}
            />
          </InlineField>
        );
      })}
    </InlineFieldRow>
  );
};
