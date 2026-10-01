import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { type EditorProps } from '../QueryEditor';
import { type TestDataDataQuery } from '../dataquery';

const ERROR_OPTIONS: Array<{ label: string; value: NonNullable<TestDataDataQuery['errorType']> }> = [
  {
    label: 'Server panic',
    value: 'server_panic',
  },
  {
    label: 'Frontend exception',
    value: 'frontend_exception',
  },
  {
    label: 'Frontend observable',
    value: 'frontend_observable',
  },
];

const FrontendErrorQueryEditor = ({ query, onChange }: EditorProps) => {
  return (
    <InlineFieldRow>
      <InlineField labelWidth={14} label="Error type">
        <Select
          options={ERROR_OPTIONS}
          value={query.errorType}
          onChange={(v) => {
            onChange({ ...query, errorType: v.value });
          }}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

export default FrontendErrorQueryEditor;
