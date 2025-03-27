import { useEffect, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, ConfirmModal, Stack, Tab, TabContent, TabsBar } from '@grafana/ui';
import { useDeletecollectionRepositoryMutation, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';
import { Page } from 'app/core/components/Page/Page';

import { FilesView } from './File/FilesView';
import GettingStarted from './GettingStarted/GettingStarted';
import GettingStartedPage from './GettingStarted/GettingStartedPage';
import { RepositoryActions } from './Repository/RepositoryActions';
import { RepositoryOverview } from './Repository/RepositoryOverview';
import { RepositoryResources } from './Repository/RepositoryResources';
import { FolderRepositoryList } from './Shared/FolderRepositoryList';
import { useRepositoryList } from './hooks';
import { checkSyncSettings } from './utils/checkSyncSettings';

const appEvents = getAppEvents();

enum TabSelection {
  Overview = 'overview',
  Resources = 'resources',
  Files = 'files',
  GettingStarted = 'getting-started',
  Repositories = 'repositories',
}

const connectedTabInfo = [
  { value: TabSelection.Overview, label: 'Overview', title: 'Repository overview' },
  { value: TabSelection.Resources, label: 'Resources', title: 'Resources saved in Grafana database' },
  { value: TabSelection.Files, label: 'Files', title: 'The raw file list from the repository' },
  { value: TabSelection.GettingStarted, label: 'Getting started', title: 'Getting started' },
];

const disconnectedTabInfo = [
  { value: TabSelection.Repositories, label: 'Repositories', title: 'List of repositories' },
  { value: TabSelection.GettingStarted, label: 'Getting started', title: 'Getting started' },
];

export default function HomePage() {
  const [items, isLoading] = useRepositoryList({ watch: true });
  const settings = useGetFrontendSettingsQuery();
  const [deleteAll, deleteAllResult] = useDeletecollectionRepositoryMutation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { instanceConnected } = checkSyncSettings(items);
  const [activeTab, setActiveTab] = useState<TabSelection>(
    instanceConnected ? TabSelection.Overview : TabSelection.Repositories
  );

  useEffect(() => {
    if (deleteAllResult.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['All configured repositories deleted'],
      });
    }
  }, [deleteAllResult.isSuccess]);

  useEffect(() => {
    setActiveTab(instanceConnected ? TabSelection.Overview : TabSelection.Repositories);
  }, [instanceConnected]);

  // Early return for onboarding
  if (!items?.length && !isLoading) {
    return <GettingStartedPage items={items ?? []} />;
  }

  const onConfirmDelete = () => {
    deleteAll({});
    setShowDeleteModal(false);
  };

  const renderTabContent = () => {
    if (!instanceConnected) {
      switch (activeTab) {
        case TabSelection.Repositories:
          return <FolderRepositoryList items={items ?? []} />;
        case TabSelection.GettingStarted:
          return <GettingStarted items={items ?? []} />;
        default:
          return null;
      }
    }

    const repo = items?.[0];
    if (!repo) {
      return null;
    }

    switch (activeTab) {
      case TabSelection.Overview:
        return <RepositoryOverview repo={repo} />;
      case TabSelection.Resources:
        return <RepositoryResources repo={repo} />;
      case TabSelection.Files:
        return <FilesView repo={repo} />;
      case TabSelection.GettingStarted:
        return <GettingStarted items={items ?? []} />;
      default:
        return null;
    }
  };

  return (
    <Page
      navId="provisioning"
      subTitle="View and manage your configured repositories"
      actions={instanceConnected && items?.length ? <RepositoryActions repository={items[0]} /> : undefined}
    >
      <Page.Contents isLoading={isLoading}>
        {settings.data?.legacyStorage && (
          <Alert
            title="Legacy storage detected"
            severity="error"
            buttonContent={<>Remove all configured repositories</>}
            onRemove={() => {
              setShowDeleteModal(true);
            }}
          >
            Configured repositories will not work while running legacy storage.
          </Alert>
        )}
        <ConfirmModal
          isOpen={showDeleteModal}
          title="Delete all configured repositories"
          body="Are you sure you want to delete all configured repositories? This action cannot be undone."
          confirmText="Delete repositories"
          onConfirm={onConfirmDelete}
          onDismiss={() => setShowDeleteModal(false)}
        />
        <Stack direction="column" gap={2}>
          <TabsBar>
            {(instanceConnected ? connectedTabInfo : disconnectedTabInfo).map((t) => (
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
