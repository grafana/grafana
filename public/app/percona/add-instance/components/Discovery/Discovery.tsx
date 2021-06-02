import React, { FC, useEffect, useState } from 'react';
import DiscoveryService from './Discovery.service';
import Credentials from './components/Credentials/Credentials';
import Instances from './components/Instances/Instances';
import { getStyles } from './Discovery.styles';
import { DiscoverySearchPanelProps } from './Discovery.types';

const Discovery: FC<DiscoverySearchPanelProps> = ({ selectInstance }) => {
  const styles = getStyles();

  const [instances, setInstances] = useState([] as any);
  const [credentials, setCredentials] = useState({ aws_secret_key: '', aws_access_key: '' });
  const [loading, startLoading] = useState(false);

  useEffect(() => {
    const updateInstances = async () => {
      try {
        const result = await DiscoveryService.discoveryRDS(credentials);

        if (result) {
          setInstances(result.rds_instances);
        }
      } catch (e) {
        console.error(e);
      } finally {
        startLoading(false);
      }
    };

    if (credentials.aws_secret_key && credentials.aws_access_key) {
      startLoading(true);
      updateInstances();
    }
  }, [credentials]);

  return (
    <>
      <div className={styles.content}>
        <Credentials onSetCredentials={setCredentials} />
        <Instances instances={instances} selectInstance={selectInstance} credentials={credentials} loading={loading} />
      </div>
    </>
  );
};

export default Discovery;
