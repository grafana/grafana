import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { useParams } from 'react-router-dom-v5-compat';

import { SelectableValue, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, EmptyState, Spinner, Tab, TabContent, TabsBar, Text, TextLink } from '@grafana/ui';
import { useGetFrontendSettingsQuery, useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { isNotFoundError } from 'app/features/alerting/unified/api/util';

import { FilesView } from '../File/FilesView';
import { InlineSecureValueWarning } from '../components/InlineSecureValueWarning';
import { PROVISIONING_URL } from '../constants';

import { RepositoryActions } from './RepositoryActions';
import { RepositoryOverview } from './RepositoryOverview';
import { RepositoryResources } from './RepositoryResources';

enum TabSelection {
  Overview = 'overview',
  Resources = 'resources',
  Files = 'files',
}

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

  const tabInfo = useMemo<SelectableValue<TabSelection>>(
    () => [
      {
        value: TabSelection.Overview,
        label: t('provisioning.repository-status-page.tab-overview', 'Overview'),
        title: t('provisioning.repository-status-page.tab-overview-title', 'Repository overview'),
      },
      {
        value: TabSelection.Resources,
        label: t('provisioning.repository-status-page.tab-resources', 'Resources'),
        title: t('provisioning.repository-status-page.tab-resources-title', 'Resources saved in grafana database'),
      },
      {
        value: TabSelection.Files,
        label: t('provisioning.repository-status-page.tab-files', 'Files'),
        title: t('provisioning.repository-status-page.tab-files-title', 'The raw file list from the repository'),
      },
    ],
    []
  );

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: data?.spec?.title ?? t('provisioning.repository-status-page.title', 'Repository Status'),
        subTitle: data?.spec?.description,
      }}
      actions={data && <RepositoryActions repository={data} />}
    >
      <Page.Contents isLoading={query.isLoading}>
        {settings.data?.legacyStorage && (
          <Alert
            title={t('provisioning.repository-status-page.title-legacy-storage', 'Legacy Storage')}
            severity="error"
          >
            <Trans i18nKey="provisioning.repository-status-page.legacy-storage-message">
              Instance is not yet running unified storage -- requires migration wizard
            </Trans>
          </Alert>
        )}
        <InlineSecureValueWarning repo={data} />
        {notFound ? (
          <EmptyState
            message={t('provisioning.repository-status-page.not-found-message', 'Repository not found')}
            variant="not-found"
          >
            <Text element={'p'}>
              <Trans i18nKey="provisioning.repository-status-page.repository-config-exists-configuration">
                Make sure the repository config exists in the configuration file.
              </Trans>
            </Text>
            <TextLink href={PROVISIONING_URL}>
              <Trans i18nKey="provisioning.repository-status-page.back-to-repositories">Back to repositories</Trans>
            </TextLink>
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
                    <Alert
                      title={t('provisioning.repository-status-page.title-queued-for-deletion', 'Queued for deletion')}
                      severity="warning"
                    >
                      <Spinner />{' '}
                      <Trans i18nKey="provisioning.repository-status-page.cleaning-up-resources">
                        Cleaning up repository resources
                      </Trans>
                    </Alert>
                  )}
                  {tab === TabSelection.Overview && <RepositoryOverview repo={data} />}
                  {tab === TabSelection.Resources && <RepositoryResources repo={data} />}
                  {tab === TabSelection.Files && <FilesView repo={data} />}
                </TabContent>
              </>
            ) : (
              <div>
                <Trans i18nKey="provisioning.repository-status-page.not-found">not found</Trans>
              </div>
            )}
          </>
        )}
      </Page.Contents>
    </Page>
  );
}
