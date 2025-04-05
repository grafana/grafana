import { useMemo, useState } from 'react';

import { Alert, ConfirmModal, Stack, Tab, TabContent, TabsBar } from '@grafana/ui';
import { useDeletecollectionRepositoryMutation, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';

import GettingStarted from './GettingStarted/GettingStarted';
import GettingStartedPage from './GettingStarted/GettingStartedPage';
import { FolderRepositoryList } from './Shared/FolderRepositoryList';
import { useRepositoryList } from './hooks/useRepositoryList';

enum TabSelection {
  Repositories = 'repositories',
  GettingStarted = 'getting-started',
}

export default function HomePage() {
  const [items, isLoading] = useRepositoryList({ watch: true });
  const settings = useGetFrontendSettingsQuery();
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
        return <FolderRepositoryList items={items ?? []} />;
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
