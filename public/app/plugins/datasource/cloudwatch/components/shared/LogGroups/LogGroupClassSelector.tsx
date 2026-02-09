import { EditorField } from '@grafana/plugin-ui';
import { RadioButtonGroup } from '@grafana/ui';

import { LogGroupClass } from '../../../dataquery.gen';

export interface LogGroupClassSelectorProps {
  value: LogGroupClass | undefined;
  onChange: (logGroupClass: LogGroupClass) => void;
  disabled?: boolean;
}

const logGroupClassOptions = [
  { label: 'Standard', value: 'STANDARD' as const },
  { label: 'Infrequent Access', value: 'INFREQUENT_ACCESS' as const },
];

export const LogGroupClassSelector = ({ value, onChange, disabled }: LogGroupClassSelectorProps) => {
  return (
    <EditorField label="Class" tooltip="Filter log groups by log group class">
      <RadioButtonGroup
        options={logGroupClassOptions}
        value={value ?? 'STANDARD'}
        onChange={onChange}
        disabled={disabled}
        size="md"
      />
    </EditorField>
  );
};
