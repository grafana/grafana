import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { ConfirmModal, LinkButton, Stack, Tab, TabContent, TabsBar } from '@grafana/ui';
import { useDeletecollectionRepositoryMutation } from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';
import { useSelector } from 'app/types/store';

import { ConnectionsTabContent } from './Connection/ConnectionsTabContent';
import GettingStarted from './GettingStarted/GettingStarted';
import { Migrate } from './Migrate/Migrate';
import { ConnectRepositoryButton } from './Shared/ConnectRepositoryButton';
import { RepositoryList } from './Shared/RepositoryList';
import { CONNECTIONS_URL } from './constants';
import { useConnectionList } from './hooks/useConnectionList';
import { useRepositoryList } from './hooks/useRepositoryList';

export default function HomePage() {
  const [items, isLoadingRepos] = useRepositoryList({ watch: true });
  const [connections, isLoadingConnections, connectionsError] = useConnectionList({ watch: true });
  const [deleteAll] = useDeletecollectionRepositoryMutation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const isLoading = isLoadingRepos || isLoadingConnections;
  const isStatsEnabled = !!config.featureToggles.provisioningExport;

  const urlTab = searchParams.get('tab');
  const defaultTab = useMemo(() => {
    if (isLoading) {
      return 'repositories';
    }
    if (items?.length) {
      return 'repositories';
    }
    if (connections?.length) {
      return 'connections';
    }
    return 'getting-started';
  }, [isLoading, items?.length, connections?.length]);

  // If the URL points at the stats tab but the feature flag is off (e.g. a stale
  // bookmark), fall back to the default tab so the bar, content, and action button
  // stay in sync.
  const activeTab = urlTab === 'stats' && !isStatsEnabled ? defaultTab : (urlTab ?? defaultTab);

  // Handler to update URL when tab changes
  const handleTabChange = (tab: string) => {
    searchParams.set('tab', tab);
    setSearchParams(searchParams, { replace: true });
  };

  const tabInfo = useMemo(() => {
    const tabs = [
      {
        value: 'repositories',
        label: t('provisioning.home-page.tab-repositories', 'Repositories'),
        title: t('provisioning.home-page.tab-repositories-title', 'List of repositories'),
      },
      {
        value: 'connections',
        label: t('provisioning.home-page.tab-connections', 'Connections'),
        title: t('provisioning.home-page.tab-connections-title', 'List of connections'),
      },
      {
        value: 'getting-started',
        label: t('provisioning.home-page.tab-getting-started', 'Get started'),
        title: t('provisioning.home-page.tab-getting-started-title', 'Get started'),
      },
    ];

    if (isStatsEnabled) {
      tabs.push({
        value: 'stats',
        label: t('provisioning.home-page.tab-stats', 'Migrate to GitOps'),
        title: t('provisioning.home-page.tab-stats-title', 'Migrate to GitOps'),
      });
    }

    return tabs;
  }, [isStatsEnabled]);

  const onConfirmDelete = () => {
    deleteAll({});
    setShowDeleteModal(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'connections':
        return <ConnectionsTabContent items={connections ?? []} error={connectionsError} />;
      case 'getting-started':
        return <GettingStarted items={items ?? []} />;
      case 'stats':
        return <Migrate />;
      case 'repositories':
      default:
        return <RepositoryList items={items ?? []} />;
    }
  };

  const renderActions = () => {
    switch (activeTab) {
      case 'connections':
        return (
          <LinkButton variant="primary" href={`${CONNECTIONS_URL}/new`}>
            <Trans i18nKey="provisioning.connections.add-connection">Add connection</Trans>
          </LinkButton>
        );
      case 'getting-started':
      case 'stats':
        return null;
      case 'repositories':
      default:
        return <ConnectRepositoryButton items={items} />;
    }
  };

  // Each tab maps to its own nav node so breadcrumbs and the command palette
  // can deep-link directly to it. The backend registers the Migrate child
  // node when the provisioningExport flag is on, but the navIndex on the
  // client may lag (e.g. cached frontend bundle, mismatched feature toggles).
  // If the id isn't in the index yet, fall back to the parent provisioning
  // nav so the page renders instead of showing "Page not found".
  const navIndex = useSelector((state) => state.navIndex);
  const migrateNavId = 'provisioning-migrate-to-gitops';
  const navId =
    activeTab === 'stats' && isStatsEnabled && navIndex[migrateNavId] ? migrateNavId : 'provisioning';

  return (
    <Page
      navId={navId}
      subTitle={t('provisioning.home-page.subtitle', 'View and manage your configured repositories')}
      actions={renderActions()}
    >
      <Page.Contents isLoading={isLoading}>
        <ConfirmModal
          isOpen={showDeleteModal}
          title={t(
            'provisioning.home-page.title-delete-all-configured-repositories',
            'Delete all configured repositories'
          )}
          body={t(
            'provisioning.home-page.confirm-delete-repositories',
            'Are you sure you want to delete all configured repositories? This action cannot be undone.'
          )}
          confirmText={t('provisioning.home-page.button-delete-repositories', 'Delete repositories')}
          onConfirm={onConfirmDelete}
          onDismiss={() => setShowDeleteModal(false)}
        />
        <Stack direction="column" gap={2}>
          <TabsBar>
            {tabInfo.map((t) => (
              <Tab
                key={t.value}
                label={t.label}
                active={activeTab === t.value}
                onChangeTab={() => handleTabChange(t.value)}
                title={t.title}
              />
            ))}
          </TabsBar>
          <TabContent>{renderTabContent()}</TabContent>
        </Stack>
      </Page.Contents>
    </Page>
  );
}
