import { useEffect, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, ConfirmModal, Modal, Stack, Tab, TabContent, TabsBar } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { ExportToRepository } from './ExportToRepository';
import { FilesView } from './FilesView';
import { FolderRepositoryList } from './FolderRepositoryList';
import GettingStarted from './GettingStarted/GettingStarted';
import GettingStartedPage from './GettingStarted/GettingStartedPage';
import { MigrateToRepository } from './MigrateToRepository';
import { RepositoryActions } from './RepositoryActions';
import { RepositoryOverview } from './RepositoryOverview';
import { RepositoryResources } from './RepositoryResources';
import { useDeletecollectionRepositoryMutation, useGetFrontendSettingsQuery } from './api';
import { useRepositoryList } from './hooks';
import { checkSyncSettings } from './utils';

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
  { value: TabSelection.Resources, label: 'Resources', title: 'Resources saved in grafana database' },
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [instanceConnected] = checkSyncSettings(settings.data);
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
    return <GettingStartedPage />;
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
          return <GettingStarted />;
        default:
          return null;
      }
    }

    // At this point we know items exists and has length > 0
    const repo = items![0];
    switch (activeTab) {
      case TabSelection.Overview:
        return <RepositoryOverview repo={repo} />;
      case TabSelection.Resources:
        return <RepositoryResources repo={repo} />;
      case TabSelection.Files:
        return <FilesView repo={repo} />;
      case TabSelection.GettingStarted:
        return <GettingStarted />;
      default:
        return null;
    }
  };

  return (
    <Page
      navId="provisioning"
      subTitle="View and manage your configured repositories"
      actions={
        instanceConnected && items?.length ? (
          <RepositoryActions
            repository={items[0]}
            showMigrateButton={settings.data?.legacyStorage}
            onExportClick={() => setShowExportModal(true)}
            onMigrateClick={() => setShowMigrateModal(true)}
          />
        ) : undefined
      }
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
        {showExportModal && items?.length && (
          <Modal isOpen={true} title="Export to Repository" onDismiss={() => setShowExportModal(false)}>
            <ExportToRepository repo={items[0]} />
          </Modal>
        )}
        {showMigrateModal && items?.length && (
          <Modal isOpen={true} title="Migrate to Repository" onDismiss={() => setShowMigrateModal(false)}>
            <MigrateToRepository repo={items[0]} />
          </Modal>
        )}
        <Stack direction="column" gap={2}>
          <TabsBar>
            {(instanceConnected ? connectedTabInfo : disconnectedTabInfo).map((t) => (
              <Tab
                key={t.value}
                label={t.label}
                active={activeTab === t.value}
                onChangeTab={() => setActiveTab(t.value as TabSelection)}
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
