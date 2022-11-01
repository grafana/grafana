import { AddBackupFormProps } from '../AddBackupPage.types';
export interface RetryModeSelectorProps extends Pick<AddBackupFormProps, 'retryMode'> {
  disabled?: boolean;
}
