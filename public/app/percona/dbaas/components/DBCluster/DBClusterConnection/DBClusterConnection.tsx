import { logger } from '@percona/platform-core';
import React, { FC, useEffect, useState } from 'react';

import { Spinner, useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';

import { DBClusterConnection as ConnectionParams, DBClusterStatus } from '../DBCluster.types';
import { newDBClusterService } from '../DBCluster.utils';

import { INITIAL_CONNECTION } from './DBClusterConnection.constants';
import { getStyles } from './DBClusterConnection.styles';
import { DBClusterConnectionProps } from './DBClusterConnection.types';
import { DBClusterConnectionItem } from './DBClusterConnectionItem/DBClusterConnectionItem';
import { DBClusterConnectionPassword } from './DBClusterConnectionPassword/DBClusterConnectionPassword';

export const DBClusterConnection: FC<DBClusterConnectionProps> = ({ dbCluster }) => {
  const styles = useStyles(getStyles);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ConnectionParams>(INITIAL_CONNECTION);
  const { host, password, port, username } = connection;
  const { status, databaseType } = dbCluster;
  const isClusterReady = status && status === DBClusterStatus.ready;

  useEffect(() => {
    const getClusterConnection = async () => {
      try {
        setLoading(true);
        const dbClusterService = newDBClusterService(databaseType);
        const connection = await dbClusterService.getDBClusterCredentials(dbCluster);

        if (connection) {
          setConnection(connection.connection_credentials);
        }
      } catch (e) {
        logger.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (isClusterReady) {
      getClusterConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {loading && status !== DBClusterStatus.suspended && <Spinner />}
      </div>
    </>
  );
};
