/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { FC, useMemo } from 'react';

import { Tooltip, useTheme, Icon, IconName } from '@grafana/ui';
import { Ellipsis } from 'app/percona/shared/components/Elements/Icons';

import { BackupStatus, RestoreStatus } from '../../Backup.types';
import { formatStatus } from '../../Backup.utils';

import { Messages } from './Status.messages';
import { getStyles } from './Status.styles';
import { StatusProps } from './Status.types';

const pendingStates = [
  BackupStatus.BACKUP_STATUS_PENDING,
  BackupStatus.BACKUP_STATUS_IN_PROGRESS,
  RestoreStatus.RESTORE_STATUS_IN_PROGRESS,
];

const successfulStates = [BackupStatus.BACKUP_STATUS_SUCCESS, RestoreStatus.RESTORE_STATUS_SUCCESS];
const errorStates = [
  BackupStatus.BACKUP_STATUS_ERROR,
  RestoreStatus.RESTORE_STATUS_ERROR,
  BackupStatus.BACKUP_STATUS_INVALID,
  RestoreStatus.RESTORE_STATUS_INVALID,
];

export const Status: FC<StatusProps> = ({ status, showLogsAction = false, onLogClick = () => null }) => {
  const statusMsg = formatStatus(status);
  const theme = useTheme();
  const styles = getStyles(theme);
  const statusStyles = useMemo(
    () => ({
      [styles.statusSuccess]: successfulStates.includes(status),
      [styles.statusError]: errorStates.includes(status),
    }),
    [status, styles.statusSuccess, styles.statusError]
  );
  const isPending = useMemo(() => pendingStates.includes(status), [status]);
  const backupSucceeded = useMemo(() => successfulStates.includes(status), [status]);

  return (
    <div className={styles.statusContainer}>
      {isPending ? (
        <span data-testid="statusPending" className={styles.ellipsisContainer}>
          <Ellipsis />
        </span>
      ) : (
        <span data-testid="statusMsg" className={cx(statusStyles)}>
          <Tooltip placement="top" content={statusMsg}>
            {backupSucceeded ? (
              <Icon name="check-circle" size="xl" data-testid="success-icon" />
            ) : (
              <Icon name={'times-circle' as IconName} size="xl" data-testid="fail-icon" />
            )}
          </Tooltip>
        </span>
      )}
      {showLogsAction && (
        <span role="button" className={styles.logs} onClick={onLogClick}>
          {Messages.logs}
        </span>
      )}
    </div>
  );
};
