import { ReactNode } from 'react';
import { FieldInputProps, FieldMetaState, UseFieldConfig } from 'react-final-form';
import { IconName } from '@grafana/ui';
import { FieldInputAttrs } from '@percona/platform-core/dist/shared/types';
import { Validator } from '@percona/platform-core/dist/shared/validators';

export interface SwitchFieldRenderProps {
  input: FieldInputProps<string, HTMLInputElement>;
  meta: FieldMetaState<string>;
}

export interface SwitchFieldProps extends UseFieldConfig<boolean> {
  disabled?: boolean;
  fieldClassName?: string;
  inputProps?: FieldInputAttrs;
  label?: string | ReactNode;
  name: string;
  validators?: Validator[];
  tooltip?: string;
  tooltipIcon?: IconName;
}
