import React, { FC, useEffect, useState } from 'react';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import DiscoveryService from './Discovery.service';
import Credentials from './components/Credentials/Credentials';
import Instances from './components/Instances/Instances';
import { getStyles } from './Discovery.styles';
import { DiscoverySearchPanelProps } from './Discovery.types';
import { logger } from '@percona/platform-core';
import { DISCOVERY_RDS_CANCEL_TOKEN } from './Discovery.constants';

const Discovery: FC<DiscoverySearchPanelProps> = ({ selectInstance }) => {
  const styles = getStyles();

  const [instances, setInstances] = useState([] as any);
  const [credentials, setCredentials] = useState({ aws_secret_key: '', aws_access_key: '' });
  const [loading, startLoading] = useState(false);
  const [generateToken] = useCancelToken();

  useEffect(() => {
    const updateInstances = async () => {
      try {
        const result = await DiscoveryService.discoveryRDS(credentials, generateToken(DISCOVERY_RDS_CANCEL_TOKEN));

        if (result) {
          setInstances(result.rds_instances);
        }
      } catch (e) {
        if (isApiCancelError(e)) {
          return;
        }
        logger.error(e);
      }
      startLoading(false);
    };

    if (
      (credentials.aws_secret_key && credentials.aws_access_key) ||
      (!credentials.aws_secret_key && !credentials.aws_access_key)
    ) {
      startLoading(true);
      updateInstances();
    }
  }, [credentials]);

  return (
    <>
      <div className={styles.content}>
        <Credentials onSetCredentials={setCredentials} selectInstance={selectInstance} />
        <Instances instances={instances} selectInstance={selectInstance} credentials={credentials} loading={loading} />
      </div>
    </>
  );
};

export default Discovery;
