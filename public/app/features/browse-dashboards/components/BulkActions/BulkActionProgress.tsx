import { Trans } from '@grafana/i18n';
import { Box, Text, Stack, Spinner } from '@grafana/ui';
import ProgressBar from 'app/features/provisioning/Shared/ProgressBar';

export type ProgressState = {
  current: number;
  total: number;
  item: string;
};

interface Props {
  progress: ProgressState;
  action: 'move' | 'delete';
}

export function BulkActionProgress({ progress, action }: Props) {
  const progressPercentage = Math.round((progress.current / progress.total) * 100);

  return (
    <Box>
      <Stack direction="row" alignItems="center">
        <Text>
          <Trans i18nKey="browse-dashboards.bulk-move-resources-form.progress">
            Progress: {{ current: progress.current }} of {{ total: progress.total }}
          </Trans>
        </Text>
        <Spinner size="sm" />
      </Stack>
      <ProgressBar progress={progressPercentage} topBottomSpacing={1} />
      <Text variant="bodySmall" color="secondary">
        {action === 'move' ? (
          <Trans i18nKey="browse-dashboards.bulk-move-resources-form.moving">Moving</Trans>
        ) : (
          <Trans i18nKey="browse-dashboards.bulk-move-resources-form.deleting">Deleting</Trans>
        )}
        : {progress.item}
      </Text>
    </Box>
  );
}
