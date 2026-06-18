import { type FormEvent } from 'react';

import { InlineField, InlineFieldRow, Input, Select, Icon } from '@grafana/ui';

import { type EditorProps } from '../QueryEditor';

const ERROR_SOURCE_OPTIONS = [
  {
    label: 'Plugin',
    value: 'plugin',
  },
  {
    label: 'Downstream',
    value: 'downstream',
  },
];

const FlakyQueryEditor = ({ query, onChange }: EditorProps) => {
  const onInputChange = (e: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.currentTarget;
    let newValue: string | number = value;

    if (type === 'number') {
      newValue = Number(value);
    }

    onChange({ ...query, [name]: newValue });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField labelWidth={14} label="Error probability" tooltip="Percentage of requests that return an error">
          <Input
            type="number"
            min={0}
            max={100}
            step={5}
            width={8}
            onChange={onInputChange}
            name="errorProbability"
            placeholder="50"
            value={query.errorProbability}
            suffix={<Icon name="percentage" />}
          />
        </InlineField>
        <InlineField labelWidth={14} label="Status code">
          <Input
            type="number"
            min={100}
            max={599}
            width={8}
            onChange={onInputChange}
            name="errorStatusCode"
            placeholder="400"
            value={query.errorStatusCode}
          />
        </InlineField>
        <InlineField labelWidth={14} label="Error source">
          <Select
            options={ERROR_SOURCE_OPTIONS}
            value={query.errorSource}
            onChange={(v) => {
              onChange({ ...query, errorSource: v.value });
            }}
            width={16}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={14} label="Error message" grow>
          <Input
            width={64}
            name="errorMessage"
            placeholder="Flaky query error"
            value={query.errorMessage}
            onChange={onInputChange}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export default FlakyQueryEditor;
