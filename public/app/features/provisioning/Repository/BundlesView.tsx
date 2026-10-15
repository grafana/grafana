import { useMemo } from 'react';

import { dateTimeFormat, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  type CellProps,
  type Column,
  EmptyState,
  Icon,
  InteractiveTable,
  Spinner,
  Stack,
  Text,
  TextLink,
} from '@grafana/ui';
import {
  type Repository,
  type ResourceListItem,
  useGetRepositoryResourcesQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { getRepoFileUrl } from '../utils/git';
import { resourceKindInfos } from '../utils/resourceKinds';

interface BundlesViewProps {
  repo: Repository;
}

/** Link to a path on the repository host, when the repository has one. */
function sourceUrl(repo: Repository, filePath: string): string | undefined {
  const spec = repo.spec;
  const config = spec?.github || spec?.githubEnterprise || spec?.gitlab || spec?.bitbucket;
  if (!spec?.type || !config) {
    return undefined;
  }

  const url = getRepoFileUrl({
    repoType: spec.type,
    url: config.url,
    branch: config.branch,
    filePath,
    pathPrefix: config.path,
  });
  return url ? textUtil.sanitizeUrl(url) : undefined;
}

type BundleCell<T extends keyof ResourceListItem = keyof ResourceListItem> = CellProps<
  ResourceListItem,
  ResourceListItem[T]
>;

export function BundlesView({ repo }: BundlesViewProps) {
  const name = repo.metadata?.name ?? '';
  const resourcesQuery = useGetRepositoryResourcesQuery({ name });

  const bundles = useMemo(
    () =>
      (resourcesQuery.data?.items ?? []).filter(
        (item) => item.group === resourceKindInfos.bundle.group && item.resource === resourceKindInfos.bundle.resource
      ),
    [resourcesQuery.data]
  );

  const columns = useMemo<Array<Column<ResourceListItem>>>(
    () => [
      {
        id: 'title',
        header: t('provisioning.bundles-view.column-name', 'Name'),
        cell: ({ row: { original } }: BundleCell) => (
          <Stack alignItems="center" gap={1}>
            <Icon name={resourceKindInfos.bundle.icon} />
            <Text>{original.title || original.name}</Text>
          </Stack>
        ),
      },
      {
        id: 'path',
        header: t('provisioning.bundles-view.column-path', 'Path'),
        cell: ({ row: { original } }: BundleCell) => {
          const url = sourceUrl(repo, original.path);
          if (!url) {
            return <Text variant="bodySmall">{original.path}</Text>;
          }
          return (
            <TextLink href={url} external variant="bodySmall">
              {original.path}
            </TextLink>
          );
        },
      },
      {
        id: 'time',
        header: t('provisioning.bundles-view.column-synced', 'Last synced'),
        cell: ({ row: { original } }: BundleCell) =>
          original.time ? (
            <Text variant="bodySmall" color="secondary">
              {dateTimeFormat(original.time)}
            </Text>
          ) : null,
      },
    ],
    [repo]
  );

  if (resourcesQuery.isLoading) {
    return <Spinner />;
  }

  if (!bundles.length) {
    return (
      <EmptyState
        variant="not-found"
        message={t('provisioning.bundles-view.empty-message', 'No bundles in this repository')}
      >
        <Text element="p" color="secondary">
          <Trans i18nKey="provisioning.bundles-view.empty-description">
            A bundle groups the files a resource needs alongside it — documentation, scripts or queries the resource
            pipeline cannot parse. Commit a Bundle manifest to this repository to see it here.
          </Trans>
        </Text>
      </EmptyState>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="provisioning.bundles-view.description">
          Bundles group the files a resource needs alongside it. A bundle&apos;s files are stored under a folder named
          after the bundle.
        </Trans>
      </Text>
      <InteractiveTable columns={columns} data={bundles} getRowId={(bundle: ResourceListItem) => bundle.name} />
    </Stack>
  );
}
