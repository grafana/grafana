import { type FormEvent } from 'react';

import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { type GrafanaQuery } from '../types';

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
const getCoreFields = (): FieldConfig[] => [
  {
    label: t('grafana-datasource.random-walk-editor.label-series-count', 'Series count'),
    id: 'seriesCount',
    placeholder: '1',
    min: 1,
    step: 1,
    tooltip: t('grafana-datasource.random-walk-editor.tooltip-series-count', 'Number of series to generate'),
  },
  {
    label: t('grafana-datasource.random-walk-editor.label-start-value', 'Start value'),
    id: 'startValue',
    placeholder: t('grafana-datasource.random-walk-editor.placeholder-start-value', 'auto'),
    step: 1,
    tooltip: t('grafana-datasource.random-walk-editor.tooltip-start-value', 'Initial value for the random walk'),
  },
  {
    label: t('grafana-datasource.random-walk-editor.label-min', 'Min'),
    id: 'min',
    placeholder: t('grafana-datasource.random-walk-editor.placeholder-min', 'none'),
    step: 0.1,
  },
  {
    label: t('grafana-datasource.random-walk-editor.label-max', 'Max'),
    id: 'max',
    placeholder: t('grafana-datasource.random-walk-editor.placeholder-max', 'none'),
    step: 0.1,
  },
];

// Fine-tuning parameters - controls randomness and variation
const getAdvancedFields = (): FieldConfig[] => [
  {
    label: t('grafana-datasource.random-walk-editor.label-spread', 'Spread'),
    id: 'spread',
    placeholder: '1',
    min: 0.5,
    step: 0.1,
    tooltip: t(
      'grafana-datasource.random-walk-editor.tooltip-spread',
      'Maximum step size between values. Higher values create more dramatic changes.'
    ),
  },
  {
    label: t('grafana-datasource.random-walk-editor.label-noise', 'Noise'),
    id: 'noise',
    placeholder: '0',
    min: 0,
    step: 0.1,
    tooltip: t(
      'grafana-datasource.random-walk-editor.tooltip-noise',
      'Random noise added to each value. Higher values create more variability.'
    ),
  },
  {
    label: t('grafana-datasource.random-walk-editor.label-drop-percent', 'Drop (%)'),
    id: 'dropPercent',
    placeholder: '0',
    min: 0,
    max: 100,
    step: 1,
    tooltip: t(
      'grafana-datasource.random-walk-editor.tooltip-drop-percent',
      'Percentage of points to randomly drop (simulates missing data)'
    ),
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
      <InlineFieldRow>{getCoreFields().map(renderField)}</InlineFieldRow>
      <InlineFieldRow>{getAdvancedFields().map(renderField)}</InlineFieldRow>
    </>
  );
};
