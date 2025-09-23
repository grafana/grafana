import { TextInputFieldProps } from 'app/percona/shared/components/Form/TextInput';

export interface SecretTogglerProps {
  secret?: string;
  readOnly?: boolean;
  small?: boolean;
  maxLength?: number;
  fieldProps?: TextInputFieldProps;
}
