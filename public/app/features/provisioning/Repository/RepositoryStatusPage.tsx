import { useLocation } from 'react-router';
import { useParams } from 'react-router-dom-v5-compat';

import { SelectableValue, urlUtil } from '@grafana/data';
import { Alert, EmptyState, Spinner, Tab, TabContent, TabsBar, Text, TextLink } from '@grafana/ui';
import { useGetFrontendSettingsQuery, useListRepositoryQuery } from 'app/api/clients/provisioning';
import { Page } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { isNotFoundError } from 'app/features/alerting/unified/api/util';

import { FilesView } from '../File/FilesView';
import { PROVISIONING_URL } from '../constants';

import { RepositoryActions } from './RepositoryActions';
import { RepositoryOverview } from './RepositoryOverview';
import { RepositoryResources } from './RepositoryResources';

enum TabSelection {
  Overview = 'overview',
  Resources = 'resources',
  Files = 'files',
}

const tabInfo: SelectableValue<TabSelection> = [
  { value: TabSelection.Overview, label: 'Overview', title: 'Repository overview' },
  { value: TabSelection.Resources, label: 'Resources', title: 'Resources saved in grafana database' },
  { value: TabSelection.Files, label: 'Files', title: 'The raw file list from the repository' },
];

export default function RepositoryStatusPage() {
  const { name = '' } = useParams();

  const query = useListRepositoryQuery({
    fieldSelector: `metadata.name=${name}`,
    watch: true,
  });
  const data = query.data?.items?.[0];
  const location = useLocation();
  const [queryParams] = useQueryParams();
  const settings = useGetFrontendSettingsQuery();
  const tab = queryParams['tab'] ?? TabSelection.Overview;

  const notFound = query.isError && isNotFoundError(query.error);

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: data?.spec?.title ?? 'Repository Status',
        subTitle: data?.spec?.description,
      }}
      actions={data && <RepositoryActions repository={data} />}
    >
      <Page.Contents isLoading={query.isLoading}>
        {settings.data?.legacyStorage && (
          <Alert title="Legacy Storage" severity="error">
            Instance is not yet running unified storage -- requires migration wizard
          </Alert>
        )}
        {notFound ? (
          <EmptyState message={`Repository not found`} variant="not-found">
            <Text element={'p'}>Make sure the repository config exists in the configuration file.</Text>
            <TextLink href={PROVISIONING_URL}>Back to repositories</TextLink>
          </EmptyState>
        ) : (
          <>
            {data ? (
              <>
                <TabsBar>
                  {tabInfo.map((t: SelectableValue) => (
                    <Tab
                      href={urlUtil.renderUrl(location.pathname, { ...queryParams, tab: t.value })}
                      key={t.value}
                      label={t.label!}
                      active={tab === t.value}
                      title={t.title}
                    />
                  ))}
                </TabsBar>
                <TabContent>
                  {data?.metadata?.deletionTimestamp && (
                    <Alert title="Queued for deletion" severity="warning">
                      <Spinner /> Cleaning up repository resources
                    </Alert>
                  )}
                  {tab === TabSelection.Overview && <RepositoryOverview repo={data} />}
                  {tab === TabSelection.Resources && <RepositoryResources repo={data} />}
                  {tab === TabSelection.Files && <FilesView repo={data} />}
                </TabContent>
              </>
            ) : (
              <div>not found</div>
            )}
          </>
        )}
      </Page.Contents>
    </Page>
  );
}
