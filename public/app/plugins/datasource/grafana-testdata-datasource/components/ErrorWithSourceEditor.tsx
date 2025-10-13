import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';

const OPTIONS = [
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
