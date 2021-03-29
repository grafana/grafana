import { useEffect } from 'react';
import { FormApi } from 'final-form';
import { logger } from '@percona/platform-core';
import { SelectableValue } from '@grafana/data';
import { isOptionEmpty, newDBClusterService } from '../../DBCluster.utils';
import { AddDBClusterFields } from '../AddDBClusterModal.types';
import { findDefaultDatabaseVersion } from './DBClusterBasicOptions.utils';

export const useDatabaseVersions = (
  form: FormApi,
  databaseType: SelectableValue,
  kubernetesCluster: SelectableValue,
  setLoadingDatabaseVersions: (loading: boolean) => void,
  setDatabaseVersions: (versions: SelectableValue[]) => void
) => {
  const getDatabaseVersions = async () => {
    try {
      const dbClusterService = newDBClusterService(databaseType.value);

      setLoadingDatabaseVersions(true);

      const databaseVersions = await dbClusterService.getDatabaseVersions(kubernetesCluster.value);

      setDatabaseVersions(databaseVersions);
      form.change(AddDBClusterFields.databaseVersion, findDefaultDatabaseVersion(databaseVersions));
    } catch (e) {
      logger.error(e);
    } finally {
      setLoadingDatabaseVersions(false);
    }
  };

  useEffect(() => {
    if (!isOptionEmpty(databaseType) && !isOptionEmpty(kubernetesCluster)) {
      getDatabaseVersions();
    }
  }, [databaseType, kubernetesCluster]);
};
