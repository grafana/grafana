import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { BackupStatus, RestoreStatus } from '../../Backup.types';
import { css } from 'emotion';

export const getStyles = stylesFactory((theme: GrafanaTheme, status: BackupStatus | RestoreStatus) => {
  const successfulStates = [BackupStatus.BACKUP_STATUS_SUCCESS, RestoreStatus.RESTORE_STATUS_SUCCESS];
  const errorStates = [
    BackupStatus.BACKUP_STATUS_ERROR,
    RestoreStatus.RESTORE_STATUS_ERROR,
    BackupStatus.BACKUP_STATUS_INVALID,
    RestoreStatus.RESTORE_STATUS_INVALID,
  ];
  const isSuccess = successfulStates.includes(status);
  const isError = errorStates.includes(status);

  if (isSuccess || isError) {
    return {
      status: css`
        color: ${isSuccess ? theme.palette.greenBase : theme.palette.redBase};
      `,
    };
  }

  return {};
});
