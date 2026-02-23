import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/plugin-ui';
import { Alert, PopoverContent, Select } from '@grafana/ui';

import { VariableQueryType } from '../../types';
import { removeMarginBottom } from '../styles';

interface VariableQueryFieldProps<T> {
  onChange: (value: T) => void;
  options: SelectableValue[];
  value: T | null;
  label: string;
  inputId?: string;
  allowCustomValue?: boolean;
  isLoading?: boolean;
  tooltip?: PopoverContent;
  interactive?: boolean;
  error?: string;
}

export const VariableQueryField = <T extends string | VariableQueryType>({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
  isLoading = false,
  inputId = label,
  tooltip,
  interactive,
  error,
}: VariableQueryFieldProps<T>) => {
  return (
    <>
      <EditorField
        label={label}
        tooltip={tooltip}
        tooltipInteractive={interactive}
        htmlFor={inputId}
        className={removeMarginBottom}
      >
        <Select
          aria-label={label}
          allowCustomValue={allowCustomValue}
          value={value}
          onChange={({ value }) => onChange(value!)}
          options={options}
          isLoading={isLoading}
          inputId={inputId}
        />
      </EditorField>
      {error && <Alert title={error} severity="error" topSpacing={1} />}
    </>
  );
};
