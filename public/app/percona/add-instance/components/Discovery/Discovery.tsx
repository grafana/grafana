import React, { FC, useCallback, useEffect, useState } from 'react';

import { useStyles } from '@grafana/ui';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';

import { DISCOVERY_RDS_CANCEL_TOKEN, INITIAL_CREDENTIALS } from './Discovery.constants';
import DiscoveryService from './Discovery.service';
import { getStyles } from './Discovery.styles';
import { DiscoverySearchPanelProps, Instance } from './Discovery.types';
import Credentials from './components/Credentials/Credentials';
import { RDSCredentialsForm } from './components/Credentials/Credentials.types';
import { DiscoveryDocs } from './components/DiscoveryDocs/DiscoveryDocs';
import Instances from './components/Instances/Instances';

const Discovery: FC<DiscoverySearchPanelProps> = ({ onSubmit, selectInstance }) => {
  const styles = useStyles(getStyles);

  const [instances, setInstances] = useState<Instance[]>([]);
  const [credentials, setCredentials] = useState(INITIAL_CREDENTIALS);
  const [loading, startLoading] = useState(false);
  const [generateToken] = useCancelToken();

  const discover = useCallback(
    async (credentials: RDSCredentialsForm, disableNotifications = false) => {
      try {
        setCredentials(credentials);
        startLoading(true);

        const result = await DiscoveryService.discoveryRDS(
          credentials,
          generateToken(DISCOVERY_RDS_CANCEL_TOKEN),
          disableNotifications
        );

        if (result) {
          setInstances(result.rds_instances);
        }
      } catch (e) {
        if (isApiCancelError(e)) {
          return;
        }
        logger.error(e);
      } finally {
        startLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setCredentials, setInstances]
  );

  useEffect(() => {
    discover(INITIAL_CREDENTIALS, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className={styles.content}>
        <Credentials discover={(credentials) => onSubmit(discover(credentials))} />
        <Instances instances={instances} selectInstance={selectInstance} credentials={credentials} loading={loading} />
        <DiscoveryDocs />
      </div>
    </>
  );
};

export default Discovery;
