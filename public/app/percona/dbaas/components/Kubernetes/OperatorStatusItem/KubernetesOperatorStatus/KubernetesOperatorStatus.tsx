import React, { FC, useMemo } from 'react';
import { cx } from 'emotion';
import { useStyles, Icon } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { getStyles } from './KubernetesOperatorStatus.styles';
import { KubernetesOperatorStatus as Status, KubernetesOperatorStatusProps } from './KubernetesOperatorStatus.types';
import { OPERATORS_DOCS_URL, STATUS_DATA_QA } from './KubernetesOperatorStatus.constants';

export const KubernetesOperatorStatus: FC<KubernetesOperatorStatusProps> = ({ status, databaseType }) => {
  const styles = useStyles(getStyles);
  const statusStyles = useMemo(
    () => ({
      [styles.statusActive]: status === Status.ok,
      [styles.statusFailed]: status === Status.invalid,
      [styles.statusUnsupported]: status === Status.unsupported,
      [styles.statusUnavailable]: status === Status.unavailable,
    }),
    [status]
  );

  return (
    <div className={styles.clusterStatusWrapper}>
      {status === Status.unavailable ? (
        <a
          href={OPERATORS_DOCS_URL[databaseType]}
          target="_blank"
          rel="noopener noreferrer"
          data-qa="cluster-install-doc-link"
        >
          <span className={cx(styles.status, statusStyles)} data-qa={`cluster-status-${STATUS_DATA_QA[status]}`}>
            {Messages.kubernetes.operatorStatus[status]}
            {status === Status.unavailable && <Icon name="external-link-alt" className={styles.InstallLinkIcon} />}
          </span>
        </a>
      ) : (
        <span className={cx(styles.status, statusStyles)} data-qa={`cluster-status-${STATUS_DATA_QA[status]}`}>
          {Messages.kubernetes.operatorStatus[status]}
        </span>
      )}
    </div>
  );
};
