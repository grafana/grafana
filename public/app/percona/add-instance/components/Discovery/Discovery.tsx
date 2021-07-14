import React, { FC, useCallback, useState } from 'react';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import DiscoveryService from './Discovery.service';
import Credentials from './components/Credentials/Credentials';
import Instances from './components/Instances/Instances';
import { getStyles } from './Discovery.styles';
import { DiscoverySearchPanelProps } from './Discovery.types';
import { logger } from '@percona/platform-core';
import { DISCOVERY_RDS_CANCEL_TOKEN } from './Discovery.constants';
import { CredentialsForm } from './components/Credentials/Credentials.types';

const Discovery: FC<DiscoverySearchPanelProps> = ({ selectInstance }) => {
  const styles = getStyles();

  const [instances, setInstances] = useState([] as any);
  const [credentials, setCredentials] = useState({ aws_secret_key: '', aws_access_key: '' });
  const [loading, startLoading] = useState(false);
  const [generateToken] = useCancelToken();

  const discover = useCallback(
    async (credentials: CredentialsForm) => {
      try {
        setCredentials(credentials);
        startLoading(true);
        const result = await DiscoveryService.discoveryRDS(credentials, generateToken(DISCOVERY_RDS_CANCEL_TOKEN));

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
    [setCredentials, setInstances]
  );

  return (
    <>
      <div className={styles.content}>
        <Credentials discover={discover} selectInstance={selectInstance} />
        <Instances instances={instances} selectInstance={selectInstance} credentials={credentials} loading={loading} />
      </div>
    </>
  );
};

export default Discovery;
