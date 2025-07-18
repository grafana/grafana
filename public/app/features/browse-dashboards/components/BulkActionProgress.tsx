import { t } from '@grafana/i18n';
import { Box, Text } from '@grafana/ui';
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
      <Text>
        {t('browse-dashboards.bulk-move-resources-form.progress', 'Progress: {{current}} of {{total}}', {
          current: progress.current,
          total: progress.total,
        })}
      </Text>
      <ProgressBar progress={progressPercentage} />
      <Text variant="bodySmall" color="secondary">
        {progress.item}
      </Text>
    </Box>
  );
}
