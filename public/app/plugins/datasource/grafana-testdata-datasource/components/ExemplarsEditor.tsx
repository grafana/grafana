import { type FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { type EditorProps } from '../QueryEditor';

const testSelectors = selectors.components.DataSource.TestData.QueryTab;

const ExemplarsEditor = ({ query, onChange }: EditorProps) => {
  const onInputChange = (e: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.currentTarget;
    let newValue: string | number | undefined = value;

    if (type === 'number') {
      // An emptied numeric field has to clear the value rather than coerce to 0,
      // otherwise blank Min and Max - which is what selects the derived value
      // range - become unreachable once either has been typed into.
      newValue = value === '' ? undefined : Number(value);
    }

    onChange({ ...query, [name]: newValue });
  };

  return (
    <InlineFieldRow>
      <InlineField labelWidth={14} label="Count" tooltip="Number of exemplars to return">
        <Input
          type="number"
          min={1}
          step={1}
          width={12}
          onChange={onInputChange}
          name="exemplarCount"
          data-testid={testSelectors.exemplarCount}
          placeholder="100"
          value={query.exemplarCount ?? ''}
        />
      </InlineField>
      <InlineField
        labelWidth={14}
        label="Min"
        tooltip="Lowest exemplar value. Empty derives the range from a reference random walk over the same time range, padded by 10%"
      >
        <Input
          type="number"
          step={0.1}
          width={12}
          onChange={onInputChange}
          name="min"
          data-testid={testSelectors.min}
          placeholder="auto"
          value={query.min ?? ''}
        />
      </InlineField>
      <InlineField labelWidth={14} label="Max" tooltip="Highest exemplar value">
        <Input
          type="number"
          step={0.1}
          width={12}
          onChange={onInputChange}
          name="max"
          data-testid={testSelectors.max}
          placeholder="auto"
          value={query.max ?? ''}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

export default ExemplarsEditor;
