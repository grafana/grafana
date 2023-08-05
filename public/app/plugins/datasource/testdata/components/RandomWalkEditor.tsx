import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';
import { TestData } from '../dataquery.gen';

const randomWalkFields = [
  { label: 'Series count', id: 'seriesCount', placeholder: '1', min: 1, step: 1 },
  { label: 'Start value', id: 'startValue', placeholder: 'auto', step: 1 },
  { label: 'Min', id: 'min', placeholder: 'none', step: 0.1 },
  { label: 'Max', id: 'max', placeholder: 'none', step: 0.1 },
  { label: 'Spread', id: 'spread', placeholder: '1', min: 0.5, step: 0.1 },
  { label: 'Noise', id: 'noise', placeholder: '0', min: 0, step: 0.1 },
  {
    label: 'Drop (%)',
    id: 'drop',
    placeholder: '0',
    min: 0,
    max: 100,
    step: 1,
    tooltip: 'Exclude some percent (chance) points',
  },
];

const testSelectors = selectors.components.DataSource.TestData.QueryTab;
type Selector = 'max' | 'min' | 'noise' | 'seriesCount' | 'spread' | 'startValue' | 'drop';

export const RandomWalkEditor = ({ onChange, query }: EditorProps) => {
  return (
    <InlineFieldRow>
      {randomWalkFields.map(({ label, id, min, step, placeholder, tooltip }) => {
        const selector = testSelectors?.[id as Selector];
        return (
          <InlineField label={label} labelWidth={14} key={id} aria-label={selector} tooltip={tooltip}>
            <Input
              width={32}
              name={id}
              type="number"
              id={`randomWalk-${id}-${query.refId}`}
              min={min}
              step={step}
              value={(query as any)[id as keyof TestData] || placeholder}
              placeholder={placeholder}
              onChange={onChange}
            />
          </InlineField>
        );
      })}
    </InlineFieldRow>
  );
};
