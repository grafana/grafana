import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRow, EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';

interface VariableQueryFieldProps {
  onChange: (value: string) => void;
  options: SelectableValue[];
  value: string;
  label: string;
  allowCustomValue?: boolean;
}

export const VariableQueryField: FC<VariableQueryFieldProps> = ({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
}) => {
  return (
    <EditorRow>
      <EditorField label={label} width={20}>
        <Select
          width={25}
          allowCustomValue={allowCustomValue}
          value={value}
          onChange={({ value }) => onChange(value!)}
          options={options}
        />
      </EditorField>
    </EditorRow>
  );
};
