import { TextInputFieldProps } from '@percona/platform-core';

export interface SecretTogglerProps {
  secret?: string;
  readOnly?: boolean;
  small?: boolean;
  maxLength?: number;
  fieldProps?: TextInputFieldProps;
}
