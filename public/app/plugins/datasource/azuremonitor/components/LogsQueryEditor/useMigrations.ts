import { useEffect, useState } from 'react';

import Datasource from '../../datasource';
import { AzureMonitorQuery } from '../../types/query';
import { isGUIDish } from '../ResourcePicker/utils';

async function migrateWorkspaceQueryToResourceQuery(
  datasource: Datasource,
  query: AzureMonitorQuery,
  onChange: (newQuery: AzureMonitorQuery) => void
) {
  if (query.azureLogAnalytics?.workspace !== undefined && !query.azureLogAnalytics.resources) {
    const isWorkspaceGUID = isGUIDish(query.azureLogAnalytics.workspace);
    let resource: string;

    if (isWorkspaceGUID) {
      resource = await datasource.resourcePickerData.getResourceURIFromWorkspace(query.azureLogAnalytics.workspace);
    } else {
      // The value of workspace is probably a template variable so we just migrate it over as-is
      resource = query.azureLogAnalytics.workspace;
    }

    const newQuery = {
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        resource: resource,
        workspace: undefined,
      },
    };

    delete newQuery.azureLogAnalytics.workspace;

    onChange(newQuery);
  }
}

interface ErrorMessage {
  title: string;
  message: string;
}

export default function useMigrations(
  datasource: Datasource,
  query: AzureMonitorQuery,
  onChange: (newQuery: AzureMonitorQuery) => void
) {
  const [migrationError, setMigrationError] = useState<ErrorMessage>();

  useEffect(() => {
    migrateWorkspaceQueryToResourceQuery(datasource, query, onChange).catch((err) =>
      setMigrationError({
        title: 'Unable to migrate workspace as a resource',
        message: err.message,
      })
    );
  }, [datasource, query, onChange]);

  return migrationError;
}
