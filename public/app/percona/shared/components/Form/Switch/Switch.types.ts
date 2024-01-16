import { FieldInputProps, FieldMetaState, UseFieldConfig } from 'react-final-form';

import { IconName } from '@grafana/ui';
import { Validator } from 'app/percona/shared/helpers/validatorsForm';

import { FieldInputAttrs, LabeledFieldProps } from '../../../helpers/types';

export interface SwitchFieldRenderProps<T = string> {
  input: FieldInputProps<T, HTMLInputElement>;
  meta: FieldMetaState<T>;
}

export interface SwitchFieldProps extends UseFieldConfig<boolean>, LabeledFieldProps {
  disabled?: boolean;
  fieldClassName?: string;
  inputProps?: FieldInputAttrs;
  validators?: Validator[];
  tooltip?: string;
  tooltipIcon?: IconName;
}
