import { FormEvent } from 'react';

import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { GrafanaQuery } from '../types';

interface RandomWalkEditorProps {
  query: GrafanaQuery;
  onChange: (value: GrafanaQuery) => void;
  onRunQuery: () => void;
}

interface FieldConfig {
  label: string;
  id: keyof GrafanaQuery;
  placeholder: string;
  min?: number;
  step?: number;
  max?: number;
  tooltip?: string;
}

// Core configuration - controls the basic shape and range
const coreFields: FieldConfig[] = [
  {
    label: 'Series count',
    id: 'seriesCount',
    placeholder: '1',
    min: 1,
    step: 1,
    tooltip: 'Number of series to generate',
  },
  {
    label: 'Start value',
    id: 'startValue',
    placeholder: 'auto',
    step: 1,
    tooltip: 'Initial value for the random walk',
  },
  { label: 'Min', id: 'min', placeholder: 'none', step: 0.1, tooltip: 'Minimum value (optional)' },
  { label: 'Max', id: 'max', placeholder: 'none', step: 0.1, tooltip: 'Maximum value (optional)' },
];

// Fine-tuning parameters - controls randomness and variation
const advancedFields: FieldConfig[] = [
  {
    label: 'Spread',
    id: 'spread',
    placeholder: '1',
    min: 0.5,
    step: 0.1,
    tooltip: 'Maximum step size between values. Higher values create more dramatic changes.',
  },
  {
    label: 'Noise',
    id: 'noise',
    placeholder: '0',
    min: 0,
    step: 0.1,
    tooltip: 'Random noise added to each value. Higher values create more variability.',
  },
  {
    label: 'Drop (%)',
    id: 'dropPercent',
    placeholder: '0',
    min: 0,
    max: 100,
    step: 1,
    tooltip: 'Percentage of points to randomly drop (simulates missing data)',
  },
];

const labelWidth = 16;

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

  const renderField = (fieldConfig: FieldConfig) => {
    const { label, id, min, step, max, placeholder, tooltip } = fieldConfig;
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
  };

  return (
    <>
      <InlineFieldRow>{coreFields.map(renderField)}</InlineFieldRow>
      <InlineFieldRow>{advancedFields.map(renderField)}</InlineFieldRow>
    </>
  );
};
