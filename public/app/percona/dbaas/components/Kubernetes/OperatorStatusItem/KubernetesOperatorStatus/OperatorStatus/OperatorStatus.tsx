import React, { FC, useMemo } from 'react';
import { cx } from 'emotion';
import { useStyles, Icon } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { getStyles } from './OperatorStatus.styles';
import { KubernetesOperatorStatus as Status } from '../KubernetesOperatorStatus.types';
import { STATUS_DATA_QA } from './OperatorStatus.constants';
import { OperatorStatusProps } from './OperatorStatus.types';

const { operatorStatus } = Messages.kubernetes;

export const OperatorStatus: FC<OperatorStatusProps> = ({ operator }) => {
  const styles = useStyles(getStyles);
  const { status, availableVersion } = operator;
  const showVersionAvailable = (status === Status.ok || status === Status.unsupported) && !!availableVersion;
  const statusStyles = useMemo(
    () => ({
      [styles.statusActive]: status === Status.ok,
      [styles.statusVersionAvailable]: showVersionAvailable,
      [styles.statusFailed]: status === Status.invalid,
      [styles.statusUnsupported]: status === Status.unsupported,
      [styles.statusUnavailable]: status === Status.unavailable,
    }),
    [status, showVersionAvailable]
  );

  return (
    <span className={cx(styles.status, statusStyles)} data-qa={`cluster-status-${STATUS_DATA_QA[status]}`}>
      {operatorStatus[status]}
      {showVersionAvailable && (
        <span className={styles.versionAvailable} data-qa="operator-version-available">
          {operatorStatus.getNewVersionAvailable(availableVersion)}
        </span>
      )}
      {(status === Status.unavailable || showVersionAvailable) && (
        <Icon name="external-link-alt" className={styles.installLinkIcon} />
      )}
    </span>
  );
};
