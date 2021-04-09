import { SelectableValue } from '@grafana/data';
import { ReactNode } from 'react';
import { FieldInputProps, FieldMetaState, UseFieldConfig } from 'react-final-form';

export interface MultiCheckboxFieldProps extends UseFieldConfig<string> {
  className?: string;
  disabled?: boolean;
  label?: string | ReactNode;
  name: string;
  required?: boolean;
  showErrorOnBlur?: boolean;
  initialOptions: SelectableValue[];
  // Validator type is not exported from platform-core
  validators?: any;
  recommendedOptions?: SelectableValue[];
  recommendedLabel?: string;
}

export interface MultiCheckboxRenderProps {
  input: FieldInputProps<string>;
  meta: FieldMetaState<string>;
}
