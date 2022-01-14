import { AddBackupFormProps } from '../AddBackupModal.types';
export interface RetryModeSelectorProps extends Pick<AddBackupFormProps, 'retryMode'> {
  disabled?: boolean;
}
