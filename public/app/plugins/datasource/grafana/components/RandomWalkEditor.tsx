import { FormEvent } from 'react';

import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { GrafanaQuery } from '../types';

interface RandomWalkEditorProps {
  query: GrafanaQuery;
  onChange: (value: GrafanaQuery) => void;
  onRunQuery: () => void;
}

const randomWalkFields: Array<{
  label: string;
  id: keyof GrafanaQuery;
  placeholder: string;
  min?: number;
  step?: number;
  max?: number;
  tooltip?: string;
}> = [
  { label: 'Series count', id: 'seriesCount', placeholder: '1', min: 1, step: 1 },
  { label: 'Start value', id: 'startValue', placeholder: 'auto', step: 1 },
  { label: 'Min', id: 'min', placeholder: 'none', step: 0.1 },
  { label: 'Max', id: 'max', placeholder: 'none', step: 0.1 },
  { label: 'Spread', id: 'spread', placeholder: '1', min: 0.5, step: 0.1 },
  { label: 'Noise', id: 'noise', placeholder: '0', min: 0, step: 0.1 },
  {
    label: 'Drop (%)',
    id: 'dropPercent',
    placeholder: '0',
    min: 0,
    max: 100,
    step: 1,
    tooltip: 'Exclude some percent (chance) points',
  },
];

const labelWidth = 14;

export const RandomWalkEditor = ({ query, onChange, onRunQuery }: RandomWalkEditorProps) => {
  const onInputChange = (e: FormEvent<HTMLInputElement>) => {
    const { name, value } = e.currentTarget;
    const numValue = value === '' ? undefined : parseFloat(value);

    onChange({
      ...query,
      [name]: numValue,
    });
    onRunQuery();
  };

  return (
    <InlineFieldRow>
      {randomWalkFields.map(({ label, id, min, step, max, placeholder, tooltip }) => {
        const value = query[id];
        return (
          <InlineField label={label} labelWidth={labelWidth} key={id} tooltip={tooltip}>
            <Input
              width={32}
              name={id}
              type="number"
              id={`randomWalk-${id}-${query.refId}`}
              min={min}
              step={step}
              max={max}
              value={typeof value === 'number' ? value : ''}
              placeholder={placeholder}
              onChange={onInputChange}
            />
          </InlineField>
        );
      })}
    </InlineFieldRow>
  );
};
