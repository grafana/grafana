import { Box, Button, Space, Stack, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { formatDate } from 'app/core/internationalization/dates';

import { GetSessionApiResponse, GetSnapshotResponseDto } from '../api';

import { MigrationInfo } from './MigrationInfo';

interface MigrationSummaryProps {
  snapshot: GetSnapshotResponseDto | undefined;
  session: GetSessionApiResponse;
  isBusy: boolean;

  disconnectIsLoading: boolean;
  onDisconnect: () => void;

  showBuildSnapshot: boolean;
  buildSnapshotIsLoading: boolean;
  onBuildSnapshot: () => void;

  showUploadSnapshot: boolean;
  uploadSnapshotIsLoading: boolean;
  onUploadSnapshot: () => void;

  showRebuildSnapshot: boolean;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

export function MigrationSummary(props: MigrationSummaryProps) {
  const {
    session,
    snapshot,
    isBusy,
    disconnectIsLoading,
    onDisconnect,

    showBuildSnapshot,
    buildSnapshotIsLoading,
    onBuildSnapshot,

    showUploadSnapshot,
    uploadSnapshotIsLoading,
    onUploadSnapshot,

    showRebuildSnapshot,
  } = props;

  const totalCount = snapshot?.stats?.total ?? 0;
  const errorCount = snapshot?.stats?.statuses?.['ERROR'] ?? 0;
  const successCount = snapshot?.stats?.statuses?.['OK'] ?? 0;
  const warningCount = snapshot?.stats?.statuses?.['WARNING'] ?? 0;

  return (
    <Box
      borderColor="weak"
      borderStyle="solid"
      padding={2}
      display="flex"
      gap={4}
      alignItems="center"
      justifyContent="space-between"
    >
      <Stack gap={4} wrap>
        <MigrationInfo title={t('migrate-to-cloud.summary.snapshot-date', 'Snapshot timestamp')}>
          {snapshot?.created ? (
            formatDate(snapshot.created, DATE_FORMAT)
          ) : (
            <Text color="secondary">
              <Trans i18nKey="migrate-to-cloud.summary.snapshot-not-created">Not yet created</Trans>
            </Text>
          )}
        </MigrationInfo>

        <MigrationInfo title={t('migrate-to-cloud.summary.total-resource-count', 'Total resources')}>
          {totalCount}
        </MigrationInfo>

        <MigrationInfo title={t('migrate-to-cloud.summary.errored-resource-count', 'Errors')}>
          {errorCount}
        </MigrationInfo>

        <MigrationInfo title={t('migrate-to-cloud.summary.successful-resource-count', 'Successfully migrated')}>
          {successCount + warningCount}
        </MigrationInfo>

        <MigrationInfo title={t('migrate-to-cloud.summary.target-stack-title', 'Uploading to')}>
          {session.slug}
          <Space h={1} layout="inline" />
          <Button
            disabled={isBusy}
            onClick={onDisconnect}
            variant="secondary"
            size="sm"
            icon={disconnectIsLoading ? 'spinner' : undefined}
          >
            <Trans i18nKey="migrate-to-cloud.summary.disconnect">Disconnect</Trans>
          </Button>
        </MigrationInfo>
      </Stack>

      <Stack gap={2} wrap justifyContent="flex-end">
        {showBuildSnapshot && (
          <Button disabled={isBusy} onClick={onBuildSnapshot} icon={buildSnapshotIsLoading ? 'spinner' : undefined}>
            <Trans i18nKey="migrate-to-cloud.summary.start-migration">Build snapshot</Trans>
          </Button>
        )}

        {showRebuildSnapshot && (
          <Button
            disabled={isBusy}
            onClick={onBuildSnapshot}
            icon={buildSnapshotIsLoading ? 'spinner' : undefined}
            variant="secondary"
          >
            <Trans i18nKey="migrate-to-cloud.summary.rebuild-snapshot">Rebuild snapshot</Trans>
          </Button>
        )}

        {showUploadSnapshot && (
          <Button
            disabled={isBusy || uploadSnapshotIsLoading}
            onClick={onUploadSnapshot}
            icon={uploadSnapshotIsLoading ? 'spinner' : undefined}
          >
            <Trans i18nKey="migrate-to-cloud.summary.upload-migration">Upload snapshot</Trans>
          </Button>
        )}
      </Stack>
    </Box>
  );
}
