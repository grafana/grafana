import { t } from '@grafana/i18n';
import { CellProps, Text, Stack, Button } from '@grafana/ui';

import { ResourceTableItem } from './types';

export function StatusCell(props: CellProps<ResourceTableItem>) {
  const item = props.row.original;

  // Keep these here to preserve the translations
  // t('migrate-to-cloud.resource-status.migrating', 'Uploading...')

  if (item.status === 'PENDING') {
    return <Text color="secondary">{t('migrate-to-cloud.resource-status.not-migrated', 'Not yet uploaded')}</Text>;
  } else if (item.status === 'OK') {
    return <Text color="success">{t('migrate-to-cloud.resource-status.migrated', 'Uploaded to cloud')}</Text>;
  } else if (item.status === 'WARNING') {
    return <WarningCell item={item} />;
  } else if (item.status === 'ERROR') {
    return <ErrorCell item={item} />;
  }

  return <Text color="secondary">{t('migrate-to-cloud.resource-status.unknown', 'Unknown')}</Text>;
}

function ErrorCell({ item }: { item: ResourceTableItem }) {
  return (
    <Stack alignItems="center">
      <Text color="error">{t('migrate-to-cloud.resource-status.failed', 'Error')}</Text>

      {item.message && (
        <Button size="sm" variant="secondary" onClick={() => item.showDetails(item)}>
          {t('migrate-to-cloud.resource-status.error-details-button', 'Details')}
        </Button>
      )}
    </Stack>
  );
}

function WarningCell({ item }: { item: ResourceTableItem }) {
  return (
    <Stack alignItems="center">
      <Text color="warning">{t('migrate-to-cloud.resource-status.warning', 'Uploaded with warning')}</Text>

      {item.message && (
        <Button size="sm" variant="secondary" onClick={() => item.showDetails(item)}>
          {t('migrate-to-cloud.resource-status.warning-details-button', 'Details')}
        </Button>
      )}
    </Stack>
  );
}
