import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  type CellProps,
  type Column,
  EmptyState,
  Icon,
  InteractiveTable,
  Stack,
  Text,
  TextLink,
} from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { type BundleFileRef, useGetBundleQuery } from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';
import { isNotFoundError } from 'app/features/alerting/unified/api/util';

import { PROVISIONING_URL } from '../constants';
import { resourceKindInfos } from '../utils/resourceKinds';

type FileCell<T extends keyof BundleFileRef = keyof BundleFileRef> = CellProps<BundleFileRef, BundleFileRef[T]>;

function formatSize(bytes?: number): string {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function BundleViewPage() {
  const { name = '' } = useParams();
  const query = useGetBundleQuery({ name });

  const bundle = query.data;
  const notFound = query.isError && isNotFoundError(query.error);
  const hasError = query.isError && !notFound;

  const files = useMemo(() => bundle?.status?.files ?? [], [bundle]);

  const columns = useMemo<Array<Column<BundleFileRef>>>(
    () => [
      {
        id: 'path',
        header: t('provisioning.bundle-view.column-path', 'Path'),
        cell: ({ row: { original } }: FileCell) => (
          <Stack alignItems="center" gap={1}>
            <Icon name="file-blank" />
            <Text>{original.path}</Text>
          </Stack>
        ),
      },
      {
        id: 'size',
        header: t('provisioning.bundle-view.column-size', 'Size'),
        cell: ({ row: { original } }: FileCell) => (
          <Text variant="bodySmall" color="secondary">
            {formatSize(original.size)}
          </Text>
        ),
      },
    ],
    []
  );

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: name,
        subTitle: t('provisioning.bundle-view.subtitle', 'Files grouped with the resource that uses them'),
      }}
      renderTitle={(title) => (
        <Stack alignItems="center">
          <Icon name={resourceKindInfos.bundle.icon} size="xl" />
          <Text element="h1">{title}</Text>
        </Stack>
      )}
    >
      <Page.Contents isLoading={query.isLoading}>
        {hasError && (
          <Alert severity="error" title={t('provisioning.bundle-view.error', 'Failed to load bundle')}>
            {getErrorMessage(query.error)}
          </Alert>
        )}
        {notFound ? (
          <EmptyState message={t('provisioning.bundle-view.not-found', 'Bundle not found')} variant="not-found">
            <Text element="p">
              <Trans i18nKey="provisioning.bundle-view.not-found-description">
                The bundle may have been removed from the repository, or has not synced yet.
              </Trans>
            </Text>
            <TextLink href={PROVISIONING_URL}>
              <Trans i18nKey="provisioning.bundle-view.back-to-repositories">Back to repositories</Trans>
            </TextLink>
          </EmptyState>
        ) : (
          bundle && (
            <Stack direction="column" gap={3}>
              {!!bundle.status?.unresolved?.length && (
                <Alert
                  severity="warning"
                  title={t('provisioning.bundle-view.unresolved-title', 'Some declared paths matched no files')}
                >
                  <Trans i18nKey="provisioning.bundle-view.unresolved-description">
                    These paths resolved to nothing at the synced commit — a folder may have been renamed or removed, so
                    the bundle holds fewer files than it declares.
                  </Trans>
                  <Stack direction="column" gap={0}>
                    {bundle.status.unresolved.map((path) => (
                      <Text key={path} variant="bodySmall">
                        {path}
                      </Text>
                    ))}
                  </Stack>
                </Alert>
              )}

              <Stack direction="column" gap={1}>
                <Text variant="h5">
                  <Trans i18nKey="provisioning.bundle-view.declared-paths">Declared paths</Trans>
                </Text>
                <Text variant="bodySmall" color="secondary">
                  <Trans i18nKey="provisioning.bundle-view.declared-paths-description">
                    A path ending in a slash is a folder, and everything beneath it belongs to the bundle.
                  </Trans>
                </Text>
                <Stack direction="column" gap={0}>
                  {(bundle.spec?.paths ?? []).map((path) => (
                    <Text key={path} variant="bodySmall">
                      {path}
                    </Text>
                  ))}
                </Stack>
              </Stack>

              <Stack direction="column" gap={1}>
                <Stack alignItems="center" gap={1}>
                  <Text variant="h5">
                    <Trans i18nKey="provisioning.bundle-view.files">Files</Trans>
                  </Text>
                  {bundle.status?.ref && (
                    <Text variant="bodySmall" color="secondary">
                      <Trans i18nKey="provisioning.bundle-view.resolved-at" values={{ ref: bundle.status.ref }}>
                        resolved at {'{{ref}}'}
                      </Trans>
                    </Text>
                  )}
                </Stack>
                {files.length ? (
                  <InteractiveTable columns={columns} data={files} getRowId={(file: BundleFileRef) => file.name} />
                ) : (
                  <Text variant="bodySmall" color="secondary">
                    <Trans i18nKey="provisioning.bundle-view.no-files">
                      This bundle has not resolved to any files yet.
                    </Trans>
                  </Text>
                )}
              </Stack>
            </Stack>
          )
        )}
      </Page.Contents>
    </Page>
  );
}
