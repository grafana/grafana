import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { getStyles } from './KubernetesOperatorStatus.styles';
import { KubernetesOperatorStatus as Status, KubernetesOperatorStatusProps } from './KubernetesOperatorStatus.types';
import { getStatusLink } from './KubernetesOperatorStatus.utils';
import { OperatorStatus } from './OperatorStatus/OperatorStatus';

export const KubernetesOperatorStatus: FC<KubernetesOperatorStatusProps> = ({ operator, databaseType }) => {
  const styles = useStyles(getStyles);
  const { status, availableVersion } = operator;
  const showLink =
    status === Status.unavailable || ((status === Status.ok || status === Status.unsupported) && !!availableVersion);

  return (
    <div className={styles.clusterStatusWrapper}>
      {showLink ? (
        <a
          href={getStatusLink(status, databaseType, availableVersion)}
          target="_blank"
          rel="noopener noreferrer"
          data-qa="cluster-link"
        >
          <OperatorStatus operator={operator} />
        </a>
      ) : (
        <OperatorStatus operator={operator} />
      )}
    </div>
  );
};
