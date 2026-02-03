import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { ConfirmModal, LinkButton, Stack, Tab, TabContent, TabsBar } from '@grafana/ui';
import { useDeletecollectionRepositoryMutation } from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';

import { ConnectionsTabContent } from './Connection/ConnectionsTabContent';
import GettingStarted from './GettingStarted/GettingStarted';
import { ConnectRepositoryButton } from './Shared/ConnectRepositoryButton';
import { RepositoryList } from './Shared/RepositoryList';
import { CONNECTIONS_URL } from './constants';
import { useConnectionList } from './hooks/useConnectionList';
import { useRepositoryList } from './hooks/useRepositoryList';

export default function HomePage() {
  const [items, isLoadingRepos] = useRepositoryList({ watch: true });
  const [connections, isLoadingConnections] = useConnectionList({ watch: true });
  const [deleteAll] = useDeletecollectionRepositoryMutation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const isLoading = isLoadingRepos || isLoadingConnections;

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

  const activeTab = urlTab ?? defaultTab;

  // Handler to update URL when tab changes
  const handleTabChange = (tab: string) => {
    searchParams.set('tab', tab);
    setSearchParams(searchParams, { replace: true });
  };

  const tabInfo = useMemo(
    () => [
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
        label: t('provisioning.home-page.tab-getting-started', 'Getting started'),
        title: t('provisioning.home-page.tab-getting-started-title', 'Getting started'),
      },
    ],
    []
  );

  const onConfirmDelete = () => {
    deleteAll({});
    setShowDeleteModal(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'connections':
        return <ConnectionsTabContent />;
      case 'getting-started':
        return <GettingStarted items={items ?? []} />;
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
        return null;
      case 'repositories':
      default:
        return <ConnectRepositoryButton items={items} />;
    }
  };

  return (
    <Page
      navId="provisioning"
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
