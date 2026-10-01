import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { type EditorProps } from '../QueryEditor';
import { type TestDataDataQuery } from '../dataquery';

const OPTIONS: Array<{ label: string; value: NonNullable<TestDataDataQuery['errorSource']> }> = [
  {
    label: 'Plugin',
    value: 'plugin',
  },
  {
    label: 'Downstream',
    value: 'downstream',
  },
];

const ErrorWithSourceQueryEditor = ({ query, onChange }: EditorProps) => {
  return (
    <InlineFieldRow>
      <InlineField labelWidth={14} label="Error source">
        <Select
          options={OPTIONS}
          value={query.errorSource}
          onChange={(v) => {
            onChange({ ...query, errorSource: v.value });
          }}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

export default ErrorWithSourceQueryEditor;
