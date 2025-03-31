import { useEffect, useMemo, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, ConfirmModal, Stack, Tab, TabContent, TabsBar } from '@grafana/ui';
import { useDeletecollectionRepositoryMutation, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';

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

export default function HomePage() {
  const [items, isLoading] = useRepositoryList({ watch: true });
  const settings = useGetFrontendSettingsQuery();
  const [deleteAll, deleteAllResult] = useDeletecollectionRepositoryMutation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { instanceConnected } = checkSyncSettings(items);
  const [activeTab, setActiveTab] = useState<TabSelection>(
    instanceConnected ? TabSelection.Overview : TabSelection.Repositories
  );

  const connectedTabInfo = useMemo(
    () => [
      {
        value: TabSelection.Overview,
        label: t('provisioning.home-page.tab-overview', 'Overview'),
        title: t('provisioning.home-page.tab-overview-title', 'Repository overview'),
      },
      {
        value: TabSelection.Resources,
        label: t('provisioning.home-page.tab-resources', 'Resources'),
        title: t('provisioning.home-page.tab-resources-title', 'Resources saved in Grafana database'),
      },
      {
        value: TabSelection.Files,
        label: t('provisioning.home-page.tab-files', 'Files'),
        title: t('provisioning.home-page.tab-files-title', 'The raw file list from the repository'),
      },
      {
        value: TabSelection.GettingStarted,
        label: t('provisioning.home-page.tab-getting-started', 'Getting started'),
        title: t('provisioning.home-page.tab-getting-started-title', 'Getting started'),
      },
    ],
    []
  );

  const disconnectedTabInfo = useMemo(
    () => [
      {
        value: TabSelection.Repositories,
        label: t('provisioning.home-page.tab-repositories', 'Repositories'),
        title: t('provisioning.home-page.tab-repositories-title', 'List of repositories'),
      },
      {
        value: TabSelection.GettingStarted,
        label: t('provisioning.home-page.tab-getting-started', 'Getting started'),
        title: t('provisioning.home-page.tab-getting-started-title', 'Getting started'),
      },
    ],
    []
  );

  useEffect(() => {
    if (deleteAllResult.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: [t('provisioning.home-page.success-all-repositories-deleted', 'All configured repositories deleted')],
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
      subTitle={t('provisioning.home-page.subtitle', 'View and manage your configured repositories')}
      actions={instanceConnected && items?.length ? <RepositoryActions repository={items[0]} /> : undefined}
    >
      <Page.Contents isLoading={isLoading}>
        {settings.data?.legacyStorage && (
          <Alert
            title={t('provisioning.home-page.title-legacy-storage-detected', 'Legacy storage detected')}
            severity="error"
            buttonContent={
              <Trans i18nKey="provisioning.home-page.remove-all-configured-repositories">
                Remove all configured repositories
              </Trans>
            }
            onRemove={() => {
              setShowDeleteModal(true);
            }}
          >
            <Trans i18nKey="provisioning.home-page.configured-repositories-while-running-legacy-storage">
              Configured repositories will not work while running legacy storage.
            </Trans>
          </Alert>
        )}
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
