import React from 'react';

import { CellProps, Text, Stack, Button } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { MigrationResourceDTOMock } from '../mockAPI';

export function StatusCell(props: CellProps<MigrationResourceDTOMock>) {
  const { status, statusMessage } = props.row.original;

  if (status === 'not-migrated') {
    return <Text color="secondary">{t('migrate-to-cloud.resource-status.not-migrated', 'Not yet uploaded')}</Text>;
  } else if (status === 'migrating') {
    return <Text color="info">{t('migrate-to-cloud.resource-status.migrating', 'Uploading...')}</Text>;
  } else if (status === 'migrated') {
    return <Text color="success">{t('migrate-to-cloud.resource-status.migrated', 'Uploaded to cloud')}</Text>;
  } else if (status === 'failed') {
    return (
      <Stack alignItems="center">
        <Text color="error">{t('migrate-to-cloud.resource-status.failed', 'Error')}</Text>

        {statusMessage && (
          // TODO: trigger a proper modal, probably from the parent, on click
          <Button size="sm" variant="secondary" onClick={() => window.alert(statusMessage)}>
            {t('migrate-to-cloud.resource-status.error-details-button', 'Details')}
          </Button>
        )}
      </Stack>
    );
  }

  return <Text color="secondary">{t('migrate-to-cloud.resource-status.unknown', 'Unknown')}</Text>;
}
