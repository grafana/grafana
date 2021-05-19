import { useEffect } from 'react';
import { AzureMonitorQuery } from '../../types';
import Datasource from '../../datasource';

async function migrateWorkspaceQueryToResourceQuery(
  datasource: Datasource,
  query: AzureMonitorQuery,
  onChange: (newQuery: AzureMonitorQuery) => void
) {
  if (query.azureLogAnalytics.workspace !== undefined && !query.azureLogAnalytics.resource) {
    const resourceURI = await datasource.resourcePickerData.getResourceURIFromWorkspace(
      query.azureLogAnalytics.workspace
    );

    const newQuery = {
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        resource: resourceURI,
        workspace: undefined,
      },
    };

    delete newQuery.azureLogAnalytics.workspace;

    onChange(newQuery);
  }
}

export default function useMigrations(
  datasource: Datasource,
  query: AzureMonitorQuery,
  onChange: (newQuery: AzureMonitorQuery) => void
) {
  useEffect(() => {
    migrateWorkspaceQueryToResourceQuery(datasource, query, onChange);
  }, [datasource, query, onChange]);
}
