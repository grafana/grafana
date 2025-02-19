import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { useParams } from 'react-router-dom-v5-compat';

import { SelectableValue, urlUtil } from '@grafana/data';
import {
  Button,
  CellProps,
  Column,
  ConfirmModal,
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
  Modal,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { isNotFoundError } from '../alerting/unified/api/util';

import { ExportToRepository } from './ExportToRepository';
import { RepositoryOverview } from './RepositoryOverview';
import { RepositoryResources } from './RepositoryResources';
import { StatusBadge } from './StatusBadge';
import { SyncRepository } from './SyncRepository';
import {
  useGetRepositoryFilesQuery,
  Repository,
  useListRepositoryQuery,
  useDeleteRepositoryFilesWithPathMutation,
} from './api';
import { FileDetails } from './api/types';
import { PROVISIONING_URL } from './constants';

enum TabSelection {
  Overview = 'overview',
  Resources = 'resources',
  Files = 'files',
}

const tabInfo: SelectableValue<TabSelection> = [
  { value: TabSelection.Overview, label: 'Overview', title: 'Repository overview' },
  { value: TabSelection.Resources, label: 'Resources', title: 'Resources saved in grafana database' },
  { value: TabSelection.Files, label: 'Files', title: 'The raw file list from the repository' },
];

export default function RepositoryStatusPage() {
  const { name = '' } = useParams();
  const [showExportModal, setShowExportModal] = useState(false);
  const query = useListRepositoryQuery({
    fieldSelector: `metadata.name=${name}`,
    watch: true,
  });
  const data = query.data?.items?.[0];
  const location = useLocation();
  const [queryParams] = useQueryParams();
  const tab = queryParams['tab'] ?? TabSelection.Overview;

  const notFound = query.isError && isNotFoundError(query.error);
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: data?.spec?.title ?? 'Repository Status',
        subTitle: data?.spec?.description,
      }}
      actions={
        data && (
          <Stack gap={1}>
            <StatusBadge enabled={Boolean(data.spec?.sync?.enabled)} state={data.status?.sync?.state} name={name} />
            {getRemoteURL(data) && (
              <Button variant="secondary" icon="github" onClick={() => window.open(getRemoteURL(data), '_blank')}>
                Source Code
              </Button>
            )}
            <SyncRepository repository={data} />
            <Button variant="secondary" icon="upload" onClick={() => setShowExportModal(true)}>
              Export
            </Button>
            <LinkButton variant="secondary" icon="cog" href={`${PROVISIONING_URL}/${name}/edit`}>
              Settings
            </LinkButton>
          </Stack>
        )
      }
    >
      <Page.Contents isLoading={query.isLoading}>
        {notFound ? (
          <EmptyState message={`Repository not found`} variant="not-found">
            <Text element={'p'}>Make sure the repository config exists in the configuration file.</Text>
            <TextLink href={PROVISIONING_URL}>Back to repositories</TextLink>
          </EmptyState>
        ) : (
          <>
            {data ? (
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
                  {tab === TabSelection.Overview && <RepositoryOverview repo={data} />}
                  {tab === TabSelection.Resources && <RepositoryResources repo={data} />}
                  {tab === TabSelection.Files && <FilesView repo={data} />}
                </TabContent>

                {showExportModal && (
                  <Modal isOpen={true} title="Export to Repository" onDismiss={() => setShowExportModal(false)}>
                    <ExportToRepository repo={data} />
                  </Modal>
                )}
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
  const [deleteFile, deleteFileStatus] = useDeleteRepositoryFilesWithPathMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [pathToDelete, setPathToDelete] = useState<string>();
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
              <Button variant="destructive" onClick={() => setPathToDelete(path)}>
                Delete
              </Button>
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
      <ConfirmModal
        isOpen={Boolean(pathToDelete?.length) || deleteFileStatus.isLoading}
        title="Delete file in repository?"
        body={deleteFileStatus.isLoading ? 'Deleting file...' : pathToDelete}
        confirmText="Delete"
        icon={deleteFileStatus.isLoading ? `spinner` : `exclamation-triangle`}
        onConfirm={() => {
          deleteFile({
            name: name,
            path: pathToDelete!,
            message: `Deleted from repo test UI`,
          });
          setPathToDelete('');
        }}
        onDismiss={() => setPathToDelete('')}
      />
      <Stack gap={2}>
        <FilterInput placeholder="Search" autoFocus={true} value={searchQuery} onChange={setSearchQuery} />
      </Stack>
      <InteractiveTable columns={columns} data={data} pageSize={25} getRowId={(f: FileDetails) => String(f.path)} />
    </Stack>
  );
}

function getRemoteURL(repo: Repository) {
  if (repo.spec?.type === 'github') {
    const spec = repo.spec.github;
    let url = spec?.url || '';
    if (spec?.branch) {
      url += `/tree/${spec.branch}`;
    }
    return url;
  }
  return undefined;
}
