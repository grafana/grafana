import { ReactNode, useEffect, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import {
  Card,
  EmptySearchResult,
  FilterInput,
  Icon,
  IconName,
  LinkButton,
  Stack,
  TextLink,
  Text,
  Alert,
  ConfirmModal,
  Tab,
  TabsBar,
  TabContent,
  Modal,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import OnboardingPage from './OnboardingPage';
import { FeatureList } from './Setup/FeatureList';
import { StatusBadge } from './StatusBadge';
import { SyncRepository } from './SyncRepository';
import { Repository, ResourceCount, useDeletecollectionRepositoryMutation, useGetFrontendSettingsQuery } from './api';
import { PROVISIONING_URL, CONNECT_URL } from './constants';
import { useRepositoryList } from './hooks';
import { checkSyncSettings } from './utils';
import { RepositoryOverview } from './RepositoryOverview';
import { RepositoryResources } from './RepositoryResources';
import { FilesView } from './FilesView';
import { RepositoryActions } from './RepositoryActions';
import { ExportToRepository } from './ExportToRepository';
import { MigrateToRepository } from './MigrateToRepository';

const appEvents = getAppEvents();

enum TabSelection {
  Overview = 'overview',
  Resources = 'resources',
  Files = 'files',
  Features = 'features',
  Repositories = 'repositories',
}

const connectedTabInfo = [
  { value: TabSelection.Overview, label: 'Overview', title: 'Repository overview' },
  { value: TabSelection.Resources, label: 'Resources', title: 'Resources saved in grafana database' },
  { value: TabSelection.Files, label: 'Files', title: 'The raw file list from the repository' },
  { value: TabSelection.Features, label: 'Features', title: 'Available features' },
];

const disconnectedTabInfo = [
  { value: TabSelection.Repositories, label: 'Repositories', title: 'List of repositories' },
  { value: TabSelection.Features, label: 'Features', title: 'Available features' },
];

export default function RepositoryListPage() {
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
    return <OnboardingPage legacyStorage={settings.data?.legacyStorage} />;
  }

  const onConfirmDelete = () => {
    deleteAll({});
    setShowDeleteModal(false);
  };

  const renderTabContent = () => {
    if (!instanceConnected) {
      switch (activeTab) {
        case TabSelection.Repositories:
          return <RepositoryListPageContent items={items ?? []} />;
        case TabSelection.Features:
          return <FeatureList />;
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
      case TabSelection.Features:
        return <FeatureList />;
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

function RepositoryListPageContent({ items }: { items: Repository[] }) {
  const [query, setQuery] = useState('');
  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));
  const settings = useGetFrontendSettingsQuery();
  const [instanceConnected] = checkSyncSettings(settings.data);

  return (
    <Stack direction={'column'} gap={3}>
      <Stack gap={2}>
        <FilterInput placeholder="Search" value={query} onChange={setQuery} />
        {!instanceConnected && (
          <LinkButton href={CONNECT_URL} variant="primary" icon={'plus'}>
            Connect to repository
          </LinkButton>
        )}
      </Stack>
      <Stack direction={'column'}>
        {!!filteredItems.length ? (
          filteredItems.map((item) => {
            const name = item.metadata?.name ?? '';

            let icon: IconName = 'database'; // based on type
            let meta: ReactNode[] = [];
            switch (item.spec?.type) {
              case 'github':
                icon = 'github';
                const spec = item.spec.github;
                const url = item.spec.github?.url ?? '';
                let branch = url;
                if (spec?.branch) {
                  branch += `/tree/` + spec?.branch;
                }
                meta.push(
                  <TextLink key={'link'} external style={{ color: 'inherit' }} href={branch}>
                    {branch}
                  </TextLink>
                );

                if (item.status?.webhook?.id) {
                  const hook = url + `/settings/hooks/${item.status?.webhook?.id}`;
                  meta.push(
                    <TextLink key={'webhook'} style={{ color: 'inherit' }} href={hook}>
                      Webhook <Icon name={'check'} />
                    </TextLink>
                  );
                }
                break;

              case 'local':
                meta.push(
                  <Text element={'p'} key={'path'}>
                    {item.spec.local?.path ?? ''}
                  </Text>
                );
                break;
            }

            return (
              <Card key={name}>
                <Card.Figure>
                  <Icon name={icon} width={40} height={40} />
                </Card.Figure>
                <Card.Heading>
                  <Stack>
                    {item.spec?.title}{' '}
                    <StatusBadge
                      enabled={Boolean(item.spec?.sync?.enabled)}
                      state={item.status?.sync?.state}
                      name={name}
                    />
                  </Stack>
                </Card.Heading>
                <Card.Description>
                  {item.spec?.description}
                  {item.status?.stats?.length && (
                    <Stack>
                      {item.status.stats.map((v, index) => (
                        <LinkButton key={index} fill="outline" size="md" href={getListURL(item, v)}>
                          {v.count} {v.resource}
                        </LinkButton>
                      ))}
                    </Stack>
                  )}
                </Card.Description>
                <Card.Meta>{meta}</Card.Meta>
                <Card.Actions>
                  <LinkButton icon="eye" href={`${PROVISIONING_URL}/${name}`} variant="secondary">
                    View
                  </LinkButton>
                  <SyncRepository repository={item} />
                  <LinkButton variant="secondary" icon="cog" href={`${PROVISIONING_URL}/${name}/edit`}>
                    Settings
                  </LinkButton>
                </Card.Actions>
                <Card.SecondaryActions>
                  <DeleteRepositoryButton name={name} />
                </Card.SecondaryActions>
              </Card>
            );
          })
        ) : (
          <EmptySearchResult>No results matching your query</EmptySearchResult>
        )}
      </Stack>
    </Stack>
  );
}

// This should return a URL in the UI that will show the selected values
function getListURL(repo: Repository, stats: ResourceCount): string {
  if (stats.resource === 'playlists') {
    return '/playlists';
  }
  if (repo.spec?.sync.target === 'folder') {
    return `/dashboards/f/${repo.metadata?.name}`;
  }
  return '/dashboards';
}
