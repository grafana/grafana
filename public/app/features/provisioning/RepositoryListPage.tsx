import { ReactNode, useEffect, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import {
  Card,
  EmptySearchResult,
  EmptyState,
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
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import OnboardingPage from './OnboardingPage';
import { FeatureList } from './Setup/FeatureList';
import { StatusBadge } from './StatusBadge';
import { SyncRepository } from './SyncRepository';
import { Repository, ResourceCount, useDeletecollectionRepositoryMutation, useGetFrontendSettingsQuery } from './api';
import { NEW_URL, PROVISIONING_URL } from './constants';
import { useRepositoryList } from './hooks';

const appEvents = getAppEvents();

export default function RepositoryListPage() {
  const [items, isLoading] = useRepositoryList({ watch: true });
  const settings = useGetFrontendSettingsQuery();
  const [deleteAll, deleteAllResult] = useDeletecollectionRepositoryMutation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('repositories');

  useEffect(() => {
    if (deleteAllResult.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['All configured repositories deleted'],
      });
    }
  }, [deleteAllResult.isSuccess]);

  if (!items?.length && !isLoading) {
    return <OnboardingPage legacyStorage={settings.data?.legacyStorage} />;
  }

  const onConfirmDelete = () => {
    deleteAll({ deleteOptions: {} });
    setShowDeleteModal(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'repositories':
        return <RepositoryListPageContent items={items} />;
      case 'features':
        return <FeatureList />;
      default:
        return null;
    }
  };

  return (
    <Page navId="provisioning" subTitle="View and manage your configured repositories">
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
            <Tab
              label="Repositories"
              active={activeTab === 'repositories'}
              onChangeTab={() => setActiveTab('repositories')}
            />
            <Tab label="Features" active={activeTab === 'features'} onChangeTab={() => setActiveTab('features')} />
          </TabsBar>
          {renderTabContent()}
        </Stack>
      </Page.Contents>
    </Page>
  );
}

function RepositoryListPageContent({ items }: { items?: Repository[] }) {
  const [query, setQuery] = useState('');
  if (!items?.length) {
    return (
      <EmptyState
        variant="call-to-action"
        message="You haven't created any repository configs yet"
        button={
          <LinkButton icon="plus" href={NEW_URL} size="lg">
            Create repository config
          </LinkButton>
        }
      />
    );
  }

  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));

  return (
    <Stack direction={'column'} gap={3}>
      <Stack gap={2}>
        <FilterInput placeholder="Search" value={query} onChange={setQuery} />
        <LinkButton href={NEW_URL} variant="primary" icon={'plus'}>
          Add repository config
        </LinkButton>
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
