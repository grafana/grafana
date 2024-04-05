import React from 'react';

import { CellProps, Text, Stack, Button } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { MigrateDataResponseItemDto } from '../api';

export function StatusCell(props: CellProps<MigrateDataResponseItemDto>) {
  const { status, error } = props.row.original;

  // Keep these here to preserve the translations
  // t('migrate-to-cloud.resource-status.not-migrated', 'Not yet uploaded')
  // t('migrate-to-cloud.resource-status.migrating', 'Uploading...')

  if (status === 'OK') {
    return <Text color="success">{t('migrate-to-cloud.resource-status.migrated', 'Uploaded to cloud')}</Text>;
  } else if (status === 'ERROR') {
    return (
      <Stack alignItems="center">
        <Text color="error">{t('migrate-to-cloud.resource-status.failed', 'Error')}</Text>

        {error && (
          // TODO: trigger a proper modal, probably from the parent, on click
          <Button size="sm" variant="secondary" onClick={() => window.alert(error)}>
            {t('migrate-to-cloud.resource-status.error-details-button', 'Details')}
          </Button>
        )}
      </Stack>
    );
  }

  return <Text color="secondary">{t('migrate-to-cloud.resource-status.unknown', 'Unknown')}</Text>;
}
