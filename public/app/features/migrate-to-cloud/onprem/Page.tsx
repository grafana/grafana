import { skipToken } from '@reduxjs/toolkit/query/react';
import React, { useState } from 'react';

import { Alert, Box, Button, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useGetStatusQuery, useListResourcesQuery, useStartMigrationMutation } from '../api';

import { DisconnectModal } from './DisconnectModal';
import { EmptyState } from './EmptyState/EmptyState';
import { MigrationInfo } from './MigrationInfo';
import { ResourcesTable } from './ResourcesTable';

export const Page = () => {
  const { data: status, isFetching } = useGetStatusQuery();
  const { data: resources } = useListResourcesQuery(status?.enabled ? undefined : skipToken, {
    pollingInterval: 5 * 1000,
  });
  const [startMigration, { isLoading: startMigrationIsLoading, isError: startMigrationIsError }] =
    useStartMigrationMutation();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  if (!status?.enabled) {
    return <EmptyState />;
  }

  const isBusy = isFetching || isDisconnecting || startMigrationIsLoading;

  return (
    <>
      <Stack direction="column" gap={4}>
        {startMigrationIsError && (
          <Alert
            severity="error"
            title={t(
              'migrate-to-cloud.summary.error-starting-migration',
              'There was an error starting cloud migration'
            )}
          />
        )}

        {status.stackURL && (
          <Box borderColor="weak" borderStyle="solid" padding={2}>
            <Stack gap={4} alignItems="center">
              <MigrationInfo
                title={t('migrate-to-cloud.summary.target-stack-title', 'Uploading to')}
                value={
                  <>
                    {status.stackURL}{' '}
                    <Button onClick={() => setIsDisconnecting(true)} disabled={isBusy} variant="secondary" size="sm">
                      <Trans i18nKey="migrate-to-cloud.summary.disconnect">Disconnect</Trans>
                    </Button>
                  </>
                }
              />

              <div style={{ flex: '1 1 auto' }} />

              <Button
                disabled={isBusy}
                onClick={() => startMigration()}
                icon={startMigrationIsLoading ? 'spinner' : undefined}
              >
                <Trans i18nKey="migrate-to-cloud.summary.start-migration">Upload everything</Trans>
              </Button>
            </Stack>
          </Box>
        )}

        {resources && <ResourcesTable resources={resources} />}
      </Stack>

      <DisconnectModal isOpen={isDisconnecting} onDismiss={() => setIsDisconnecting(false)} />
    </>
  );
};
