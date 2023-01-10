import React from 'react';

import { Alert, useStyles2 } from '@grafana/ui';
import { useSelector } from 'app/types';

import { getPerconaServer } from '../../../../shared/core/selectors';

import { getStyles } from './PortalK8sFreeClusterPromotingMessage.styles';

export const PortalK8sFreeClusterPromotingMessage = () => {
  const styles = useStyles2(getStyles);
  const { saasHost } = useSelector(getPerconaServer);

  return (
    <Alert
      className={styles.alert}
      title={''}
      severity="info"
      data-testid="pmm-server-promote-portal-k8s-cluster-message"
    >
      <p>
        Percona has a time-limited offer for testing DBaaS with a free k8s cluster. Please{' '}
        <a href={`${saasHost}/kubernetes`} rel="noreferrer noopener" target="_blank" className={styles.link}>
          read more
        </a>{' '}
        information about this offer.
      </p>
    </Alert>
  );
};
