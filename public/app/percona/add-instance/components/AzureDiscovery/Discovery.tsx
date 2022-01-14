import React, { FC, useEffect, useState } from 'react';
import DiscoveryService from './Discovery.service';
import Credentials from './components/Credentials/Credentials';
import Instances from './components/Instances/Instances';
import { getStyles } from './Discovery.styles';
import { DiscoverySearchPanelProps, Instance } from './Discovery.types';
import { AzureCredentialsForm } from './components/Credentials/Credentials.types';
import { logger } from '@percona/platform-core';

const Discovery: FC<DiscoverySearchPanelProps> = ({ selectInstance }) => {
  const styles = getStyles();

  const [instances, setInstances] = useState<Instance[]>([]);
  const [credentials, setCredentials] = useState<AzureCredentialsForm>({});
  const [loading, startLoading] = useState(false);

  useEffect(() => {
    const updateInstances = async () => {
      try {
        const result = await DiscoveryService.discoveryAzure(credentials);
        if (result) {
          setInstances(result.azure_database_instance);
        }
      } catch (e) {
        logger.error(e);
      } finally {
        startLoading(false);
      }
    };

    if (
      credentials.azure_client_id &&
      credentials.azure_client_secret &&
      credentials.azure_tenant_id &&
      credentials.azure_subscription_id
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
