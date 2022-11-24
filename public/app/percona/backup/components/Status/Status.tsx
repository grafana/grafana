/* eslint-disable @typescript-eslint/consistent-type-assertions */
import React, { FC, useMemo } from 'react';

import { Tooltip, useTheme2, Icon, IconName } from '@grafana/ui';
import { Ellipsis } from 'app/percona/shared/components/Elements/Icons';

import { formatStatus } from '../../Backup.utils';

import { pendingStates, successfulStates } from './Status.constants';
import { Messages } from './Status.messages';
import { getStyles } from './Status.styles';
import { StatusProps } from './Status.types';

export const Status: FC<StatusProps> = ({ status, showLogsAction = false, onLogClick = () => null }) => {
  const statusMsg = formatStatus(status);
  const theme = useTheme2();
  const styles = getStyles(theme, status);
  const isPending = useMemo(() => pendingStates.includes(status), [status]);
  const backupSucceeded = useMemo(() => successfulStates.includes(status), [status]);

  return (
    <div className={styles.statusContainer}>
      {isPending ? (
        <span data-testid="statusPending" className={styles.ellipsisContainer}>
          <Ellipsis />
        </span>
      ) : (
        <span data-testid="statusMsg" className={styles.statusIcon}>
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
