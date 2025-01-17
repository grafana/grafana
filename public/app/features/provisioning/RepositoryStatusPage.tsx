import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { useParams } from 'react-router-dom-v5-compat';

import { SelectableValue, urlUtil } from '@grafana/data';
import {
  Alert,
  Card,
  CellProps,
  Column,
  EmptyState,
  FilterInput,
  InteractiveTable,
  LinkButton,
  Spinner,
  Stack,
  Tab,
  TabContent,
  TabsBar,
  Text,
  TextLink,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { isNotFoundError } from '../alerting/unified/api/util';

import { StatusBadge } from './StatusBadge';
import {
  useGetRepositoryStatusQuery,
  useListJobQuery,
  useGetRepositoryFilesQuery,
  Repository,
  ResourceListItem,
  useGetRepositoryResourcesQuery,
} from './api';
import { FileDetails } from './api/types';
import { PROVISIONING_URL } from './constants';

enum TabSelection {
  Resources = 'resources',
  Files = 'files',
  Jobs = 'jobs',
  Health = 'health',
}

const tabInfo: SelectableValue<TabSelection> = [
  { value: TabSelection.Resources, label: 'Resources', title: 'Resources saved in grafana database' },
  { value: TabSelection.Files, label: 'Files', title: 'The raw file list from the repository' },
  { value: TabSelection.Jobs, label: 'Recent events' },
  { value: TabSelection.Health, label: 'Repository health' },
];

export default function RepositoryStatusPage() {
  const { name = '' } = useParams();
  const query = useGetRepositoryStatusQuery({ name });

  const location = useLocation();
  const [queryParams] = useQueryParams();
  const tab = (queryParams['tab'] as TabSelection) ?? TabSelection.Resources;

  const notFound = query.isError && isNotFoundError(query.error);
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: query.data?.spec?.title ?? 'Repository Status',
        subTitle: 'Check the status of configured repository.',
      }}
    >
      <Page.Contents isLoading={query.isLoading}>
        {notFound ? (
          <EmptyState message={`Repository not found`} variant="not-found">
            <Text element={'p'}>Make sure the repository config exists in the configuration file.</Text>
            <TextLink href={PROVISIONING_URL}>Back to repositories</TextLink>
          </EmptyState>
        ) : (
          <>
            {query.data ? (
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
                  {tab === TabSelection.Resources && <ResourcesView repo={query.data} />}
                  {tab === TabSelection.Files && <FilesView repo={query.data} />}
                  {tab === TabSelection.Jobs && <JobsView repo={query.data} />}
                  {tab === TabSelection.Health && <RepositoryHealth repo={query.data} />}
                </TabContent>
              </>
            ) : (
              <div>not found</div>
            )}
          </>
        )}
      </Page.Contents>
    </Page>
  );
}
interface RepoProps {
  repo: Repository;
}

type FileCell<T extends keyof FileDetails = keyof FileDetails> = CellProps<FileDetails, FileDetails[T]>;

function FilesView({ repo }: RepoProps) {
  const name = repo.metadata?.name ?? '';
  const query = useGetRepositoryFilesQuery({ name });
  const [searchQuery, setSearchQuery] = useState('');
  const data = [...(query.data?.items ?? [])].filter((file) =>
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const columns: Array<Column<FileDetails>> = useMemo(
    () => [
      {
        id: 'path',
        header: 'Path',
        sortType: 'string',
        cell: ({ row: { original } }: FileCell<'path'>) => {
          const { path } = original;
          return <a href={`${PROVISIONING_URL}/${name}/file/${path}`}>{path}</a>;
        },
      },
      {
        id: 'size',
        header: 'Size (KB)',
        cell: ({ row: { original } }: FileCell<'size'>) => {
          const { size } = original;
          return (parseInt(size, 10) / 1024).toFixed(2);
        },
        sortType: 'number',
      },
      {
        id: 'hash',
        header: 'Hash',
        sortType: 'string',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row: { original } }: FileCell<'path'>) => {
          const { path } = original;
          return (
            <Stack>
              {(path.endsWith('.json') || path.endsWith('.yaml') || path.endsWith('.yml')) && (
                <LinkButton href={`${PROVISIONING_URL}/${name}/file/${path}`}>View</LinkButton>
              )}
              <LinkButton href={`${PROVISIONING_URL}/${name}/history/${path}`}>History</LinkButton>
            </Stack>
          );
        },
      },
    ],
    [name]
  );

  if (query.isLoading) {
    return (
      <Stack justifyContent={'center'} alignItems={'center'}>
        <Spinner />
      </Stack>
    );
  }

  return (
    <Stack grow={1} direction={'column'} gap={2}>
      <Stack gap={2}>
        <FilterInput placeholder="Search" autoFocus={true} value={searchQuery} onChange={setSearchQuery} />
      </Stack>
      <InteractiveTable columns={columns} data={data} pageSize={25} getRowId={(f: FileDetails) => String(f.path)} />
    </Stack>
  );
}

type ResourceCell<T extends keyof ResourceListItem = keyof ResourceListItem> = CellProps<
  ResourceListItem,
  ResourceListItem[T]
>;

function ResourcesView({ repo }: RepoProps) {
  const name = repo.metadata?.name ?? '';
  const query = useGetRepositoryResourcesQuery({ name });
  const [searchQuery, setSearchQuery] = useState('');
  const data = [...(query.data?.items ?? [])].filter((Resource) =>
    Resource.path.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const columns: Array<Column<ResourceListItem>> = useMemo(
    () => [
      {
        id: 'title',
        header: 'Title',
        sortType: 'string',
        cell: ({ row: { original } }: ResourceCell<'title'>) => {
          const { resource, name, title } = original;
          if (resource === 'dashboards') {
            return <a href={`/d/${name}`}>{title}</a>;
          }
          return <span>{title}</span>;
        },
      },
      {
        id: 'path',
        header: 'Path',
        sortType: 'string',
        cell: ({ row: { original } }: ResourceCell<'path'>) => {
          const { resource, name, path } = original;
          if (resource === 'dashboards') {
            return <a href={`/d/${name}`}>{path}</a>;
          }
          return <span>{path}</span>;
        },
      },
      {
        id: 'hash',
        header: 'Hash',
        sortType: 'string',
        cell: ({ row: { original } }: ResourceCell<'hash'>) => {
          const { hash } = original;
          return <span title={hash}>{hash.substring(0, 7)}</span>;
        },
      },
      {
        id: 'folder',
        header: 'Folder',
        sortType: 'string',
      },
    ],
    []
  );

  if (query.isLoading) {
    return (
      <Stack justifyContent={'center'} alignItems={'center'}>
        <Spinner />
      </Stack>
    );
  }

  return (
    <Stack grow={1} direction={'column'} gap={2}>
      <Stack gap={2}>
        <FilterInput placeholder="Search" autoFocus={true} value={searchQuery} onChange={setSearchQuery} />
      </Stack>
      <InteractiveTable
        columns={columns}
        data={data}
        pageSize={25}
        getRowId={(r: ResourceListItem) => String(r.path)}
      />
    </Stack>
  );
}

function JobsView({ repo }: RepoProps) {
  const name = repo.metadata?.name;
  const query = useListJobQuery({
    labelSelector: [
      {
        key: 'repository',
        operator: '=',
        value: name,
      },
    ],
  });
  const items = query?.data?.items ?? [];

  if (query.isLoading) {
    return <Spinner />;
  }
  if (query.isError) {
    return (
      <Alert title="error loading jobs">
        <pre>{JSON.stringify(query.error)}</pre>
      </Alert>
    );
  }
  if (!items?.length) {
    return (
      <div>
        No recent events...
        <br />
        Note: history is not maintained after system restart
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => {
        return (
          <Card key={item.metadata?.resourceVersion}>
            <Card.Heading>
              {item.spec?.action} / {item.status?.state}
            </Card.Heading>
            <Card.Description>
              <span>{JSON.stringify(item.spec)}</span>
              <span>{JSON.stringify(item.status)}</span>
            </Card.Description>
          </Card>
        );
      })}
    </div>
  );
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) {
    return 'N/A';
  }
  return new Date(timestamp * 1000).toLocaleString();
}

function getRemoteURL(repo: Repository): string | undefined {
  if (repo.spec?.type === 'github') {
    const spec = repo.spec.github;
    let url = `https://github.com/${spec?.owner}/${spec?.repository}/`;
    if (spec?.branch) {
      url += `tree/${spec.branch}`;
    }
    return url;
  }
  return undefined;
}

function getWebhookURL(repo: Repository): string | undefined {
  const { status, spec } = repo;
  if (spec?.type === 'github' && status?.webhook?.url) {
    const { github } = spec;
    return `https://github.com/${github?.owner}/${github?.repository}/settings/hooks/${status.webhook?.id}`;
  }
  return undefined;
}

export function RepositoryHealth({ repo }: { repo: Repository }) {
  const name = repo.metadata?.name ?? '';

  const statusQuery = useGetRepositoryStatusQuery({ name }, { pollingInterval: 5000 });

  if (statusQuery.isLoading) {
    return (
      <Stack gap={2} alignItems="center">
        <Text>Loading repository status</Text>
        <Spinner />
      </Stack>
    );
  }

  if (statusQuery.isError) {
    return (
      <Alert title="Error loading repository status" severity="error">
        <pre>{JSON.stringify(statusQuery.error, null, 2)}</pre>
      </Alert>
    );
  }

  const status = statusQuery.data?.status;
  const remoteURL = getRemoteURL(repo);
  const webhookURL = getWebhookURL(repo);

  return (
    <Stack gap={2} direction="column" alignItems="flex-start">
      <h2>Health Status</h2>
      {status?.health?.healthy ? (
        <Alert title="Repository is healthy" severity="success" style={{ width: ' 100%' }}>
          No errors found
        </Alert>
      ) : (
        <Alert title="Repository is unhealthy" severity="warning" style={{ width: ' 100%' }}>
          <Text>Details:</Text>
          {status?.health?.message && status.health.message.length > 0 && (
            <ul>
              {status.health.message.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      {remoteURL && (
        <Text>
          <TextLink external href={remoteURL}>
            {remoteURL}
          </TextLink>
        </Text>
      )}

      {webhookURL && (
        <Text>
          <TextLink external href={webhookURL}>
            Webhook
          </TextLink>
        </Text>
      )}

      <h2>Sync Status</h2>
      <StatusBadge state={status?.sync?.state} name={name} />
      <ul style={{ listStyle: 'none' }}>
        <li>
          Job ID: <b>{status?.sync.job ?? 'N/A'}</b>
        </li>
        <li>
          Last Ref: <b>{status?.sync.hash ?? 'N/A'}</b>
        </li>
        <li>
          Started: <b>{formatTimestamp(status?.sync.started)}</b>
        </li>
        <li>
          Finished: <b>{formatTimestamp(status?.sync.finished)}</b>
        </li>
      </ul>

      {status?.sync?.message && status.sync.message.length > 0 && (
        <>
          <Text>Messages:</Text>
          <ul style={{ listStyle: 'none' }}>
            {status.sync.message.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </>
      )}
    </Stack>
  );
}
