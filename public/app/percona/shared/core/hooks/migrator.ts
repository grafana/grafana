import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/core';
import { migrateAll } from 'app/features/api-keys/state/actions';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { config } from '@grafana/runtime';

import { snoozeApiKeyMigrationSummary } from '../reducers/user/user';
import { getPerconaUser } from '../selectors';
import { isPmmAdmin } from 'app/percona/shared/helpers/permissions';

export const useMigrator = () => {
  const migrationResult = useSelector((state) => state.apiKeys.migrationResult);
  const { snoozedApiKeysMigration } = useSelector(getPerconaUser);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const migrationSummaryVisible = !snoozedApiKeysMigration && migrationResult && migrationResult.failed > 0;

  useEffect(() => {
    if (!location.search.includes('force-apikey-migration=true') || !isPmmAdmin(config.bootData.user)) {
      return;
    }

    dispatch(migrateAll());
  }, [location.search, dispatch]);

  useEffect(() => {
    if (migrationResult && migrationResult.total > 0 && migrationResult.failed === 0) {
      // give some time for the app to load
      setTimeout(() => {
        appEvents.emit(AppEvents.alertSuccess, ['All api keys successfully migrated']);
      }, 1000);
    }
  }, [migrationResult]);

  const dismissSummary = () => {
    dispatch(snoozeApiKeyMigrationSummary(true));
  };

  return { migrationSummaryVisible, dismissSummary };
};
