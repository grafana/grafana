import { logger } from '@percona/platform-core';
import { FormApi } from 'final-form';
import { useEffect } from 'react';

import { SelectableValue } from '@grafana/data/src';

import { isOptionEmpty, newDBClusterService } from '../../DBCluster.utils';
import { AddDBClusterFields } from '../EditDBClusterPage.types';

import { findDefaultDatabaseVersion } from './DBClusterBasicOptions.utils';

export const useDatabaseVersions = (
  form: FormApi,
  databaseType: SelectableValue,
  kubernetesCluster: SelectableValue,
  setLoadingDatabaseVersions: (loading: boolean) => void,
  setDatabaseVersions: (versions: SelectableValue[]) => void
) => {
  useEffect(() => {
    const getDatabaseVersions = async () => {
      try {
        const dbClusterService = newDBClusterService(databaseType.value);

        setLoadingDatabaseVersions(true);

        const databaseVersions = await (
          await dbClusterService.getDatabaseVersions(kubernetesCluster.value)
        ).filter(({ disabled }) => !disabled);

        setDatabaseVersions(databaseVersions);
        form.change(AddDBClusterFields.databaseVersion, findDefaultDatabaseVersion(databaseVersions));
      } catch (e) {
        logger.error(e);
      } finally {
        setLoadingDatabaseVersions(false);
      }
    };

    if (!isOptionEmpty(databaseType) && !isOptionEmpty(kubernetesCluster)) {
      getDatabaseVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databaseType, kubernetesCluster]);
};
