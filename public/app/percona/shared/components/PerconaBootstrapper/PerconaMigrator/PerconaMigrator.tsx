import React, { FC } from 'react';

import { useMigrator } from 'app/percona/shared/core/hooks/migrator';
import { useSelector } from 'app/types';

import MigrationSummary from './components/MigrationSummary';

const PerconaMigrator: FC = () => {
  const migrationResult = useSelector((state) => state.apiKeys.migrationResult);
  const { migrationSummaryVisible, dismissSummary } = useMigrator();

  if (!migrationResult || !migrationSummaryVisible) {
    return;
  }

  return <MigrationSummary data={migrationResult} visible={migrationSummaryVisible} onDismiss={dismissSummary} />;
};

export default PerconaMigrator;
