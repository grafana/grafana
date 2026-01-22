import { useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { ConfirmModal, LinkButton, Stack, Tab, TabContent, TabsBar } from '@grafana/ui';
import { useDeletecollectionRepositoryMutation } from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';

import { ConnectionsTabContent } from './Connection/ConnectionsTabContent';
import GettingStarted from './GettingStarted/GettingStarted';
import GettingStartedPage from './GettingStarted/GettingStartedPage';
import { ConnectRepositoryButton } from './Shared/ConnectRepositoryButton';
import { RepositoryList } from './Shared/RepositoryList';
import { CONNECTIONS_URL } from './constants';
import { useRepositoryList } from './hooks/useRepositoryList';

enum TabSelection {
  Repositories = 'repositories',
  Connections = 'connections',
  GettingStarted = 'getting-started',
}

export default function HomePage() {
  const [items, isLoading] = useRepositoryList({ watch: true });
  const [deleteAll] = useDeletecollectionRepositoryMutation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabSelection>(TabSelection.Repositories);

  const tabInfo = useMemo(
    () => [
      {
        value: TabSelection.Repositories,
        label: t('provisioning.home-page.tab-repositories', 'Repositories'),
        title: t('provisioning.home-page.tab-repositories-title', 'List of repositories'),
      },
      {
        value: TabSelection.Connections,
        label: t('provisioning.home-page.tab-connections', 'Connections'),
        title: t('provisioning.home-page.tab-connections-title', 'List of connections'),
      },
      {
        value: TabSelection.GettingStarted,
        label: t('provisioning.home-page.tab-getting-started', 'Getting started'),
        title: t('provisioning.home-page.tab-getting-started-title', 'Getting started'),
      },
    ],
    []
  );

  // Early return for onboarding
  if (!items?.length && !isLoading) {
    return <GettingStartedPage items={items ?? []} />;
  }

  const onConfirmDelete = () => {
    deleteAll({});
    setShowDeleteModal(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case TabSelection.Repositories:
        return <RepositoryList items={items ?? []} />;
      case TabSelection.Connections:
        return <ConnectionsTabContent />;
      case TabSelection.GettingStarted:
        return <GettingStarted items={items ?? []} />;
      default:
        return null;
    }
  };

  const renderActions = () => {
    switch (activeTab) {
      case TabSelection.Repositories:
        return <ConnectRepositoryButton items={items} />;
      case TabSelection.Connections:
        return (
          <LinkButton variant="primary" href={`${CONNECTIONS_URL}/new`}>
            <Trans i18nKey="provisioning.connections.add-connection">Add connection</Trans>
          </LinkButton>
        );
      default:
        return null;
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
                onChangeTab={() => setActiveTab(t.value)}
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
