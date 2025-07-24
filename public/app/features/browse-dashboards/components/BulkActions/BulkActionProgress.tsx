import { Trans } from '@grafana/i18n';
import { Box, Text, Stack, Spinner } from '@grafana/ui';
import ProgressBar from 'app/features/provisioning/Shared/ProgressBar';

export interface ProgressState {
  current: number;
  total: number;
  item: string;
}

export function BulkActionProgress({ progress }: { progress: ProgressState }) {
  const progressPercentage = Math.round((progress.current / progress.total) * 100);

  return (
    <Box>
      <Stack direction="row" alignItems="center">
        <Text>
          <Trans
            i18nKey="browse-dashboards.bulk-move-resources-form.progress"
            defaults="Progress: {{current}} of {{total}}"
            values={{ current: progress.current, total: progress.total }}
          />
        </Text>
        <Spinner size="sm" />
      </Stack>
      <ProgressBar progress={progressPercentage} topBottomSpacing={1} />
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="browse-dashboards.bulk-move-resources-form.deleting" defaults="Deleting:" /> {progress.item}
      </Text>
    </Box>
  );
}
