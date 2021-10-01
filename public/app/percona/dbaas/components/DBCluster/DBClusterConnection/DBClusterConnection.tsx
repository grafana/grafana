import React, { FC, useEffect, useState } from 'react';
import { useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { DBClusterConnectionProps } from './DBClusterConnection.types';
import { DBClusterConnection as ConnectionParams, DBClusterStatus, DBClusterConnectionAPI } from '../DBCluster.types';
import { INITIAL_CONNECTION } from './DBClusterConnection.constants';
import { getStyles } from './DBClusterConnection.styles';
import { DBClusterConnectionPassword } from './DBClusterConnectionPassword/DBClusterConnectionPassword';
import { DBClusterConnectionItem } from './DBClusterConnectionItem/DBClusterConnectionItem';
import { newDBClusterService } from '../DBCluster.utils';

export const DBClusterConnection: FC<DBClusterConnectionProps> = ({ dbCluster }) => {
  const styles = useStyles(getStyles);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ConnectionParams>(INITIAL_CONNECTION);
  const { host, password, port, username } = connection;
  const { status, databaseType } = dbCluster;
  const isClusterReady = status && status === DBClusterStatus.ready;
  const getClusterConnection = async () => {
    try {
      setLoading(true);
      const dbClusterService = newDBClusterService(databaseType);
      const connection = (await dbClusterService.getDBClusterCredentials(dbCluster)) as DBClusterConnectionAPI;

      setConnection(connection.connection_credentials);
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isClusterReady) {
      getClusterConnection();
    }
  }, [status]);

  return (
    <>
      <div className={styles.connectionWrapper}>
        {!loading && isClusterReady && (
          <>
            <DBClusterConnectionItem
              label={Messages.dbcluster.table.connection.host}
              value={host}
              dataTestId="cluster-connection-host"
            />
            <DBClusterConnectionItem
              label={Messages.dbcluster.table.connection.port}
              value={port}
              dataTestId="cluster-connection-port"
            />
            <DBClusterConnectionItem
              label={Messages.dbcluster.table.connection.username}
              value={username}
              dataTestId="cluster-connection-username"
            />
            <DBClusterConnectionPassword
              label={Messages.dbcluster.table.connection.password}
              password={password}
              dataTestId="cluster-connection-password"
            />
          </>
        )}
      </div>
    </>
  );
};
