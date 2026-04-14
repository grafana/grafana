import { Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { AdvisorRedirectNotice } from 'app/features/connections/components/AdvisorRedirectNotice/AdvisorRedirectNotice';
import { RunAdvisorChecksButton } from 'app/features/connections/components/RunAdvisorChecksButton/RunAdvisorChecksButton';
import { AdvisorCheckProvider } from 'app/features/connections/hooks/useDatasourceAdvisorChecks';
import { DataSourceAddButton } from 'app/features/datasources/components/DataSourceAddButton';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';
import { getDataSourcesCount } from 'app/features/datasources/state/selectors';
import { type StoreState, useSelector } from 'app/types/store';

export function DataSourcesListPage() {
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));

  const actions =
    dataSourcesCount > 0 ? (
      <Stack direction="row" gap={1}>
        <RunAdvisorChecksButton />
        <DataSourceAddButton />
      </Stack>
    ) : undefined;
  return (
    <AdvisorCheckProvider>
      <Page navId={'connections-datasources'} actions={actions}>
        <Page.Contents>
          <AdvisorRedirectNotice />
          <DataSourcesList />
        </Page.Contents>
      </Page>
    </AdvisorCheckProvider>
  );
}
