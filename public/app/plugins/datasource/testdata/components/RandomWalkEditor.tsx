import React from 'react';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { EditorProps } from '../QueryEditor';
import { TestDataQuery } from '../types';

const randomWalkFields = [
  { label: 'Series count', id: 'seriesCount', placeholder: '1', min: 1, step: 1 },
  { label: 'Start value', id: 'startValue', placeholder: 'auto', step: 1 },
  { label: 'Spread', id: 'spread', placeholder: '1', min: 0.5, step: 0.1 },
  { label: 'Noise', id: 'noise', placeholder: '0', min: 0, step: 0.1 },
  { label: 'Min', id: 'min', placeholder: 'none', step: 0.1 },
  { label: 'Max', id: 'max', placeholder: 'none', step: 0.1 },
];

const testSelectors = selectors.components.DataSource.TestData.QueryTab;
type Selector = 'max' | 'min' | 'noise' | 'seriesCount' | 'spread' | 'startValue';

export const RandomWalkEditor = ({ onChange, query }: EditorProps) => {
  return (
    <InlineFieldRow>
      {randomWalkFields.map(({ label, id, min, step, placeholder }) => {
        const selector = testSelectors?.[id as Selector];
        return (
          <InlineField label={label} labelWidth={14} key={id} aria-label={selector}>
            <Input
              width={32}
              name={id}
              type="number"
              id={`randomWalk-${id}-${query.refId}`}
              min={min}
              step={step}
              value={query[id as keyof TestDataQuery] || placeholder}
              placeholder={placeholder}
              onChange={onChange}
            />
          </InlineField>
        );
      })}
    </InlineFieldRow>
  );
};
