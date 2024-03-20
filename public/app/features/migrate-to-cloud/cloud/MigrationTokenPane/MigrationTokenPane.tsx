import React from 'react';

import { Box, Button, ModalsController, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { useCreateMigrationTokenMutation, useDeleteMigrationTokenMutation, useHasMigrationTokenQuery } from '../../api';
import { InfoItem } from '../../shared/InfoItem';

import { DeleteMigrationTokenModal } from './DeleteMigrationTokenModal';
import { MigrationTokenModal } from './MigrationTokenModal';
import { TokenStatus } from './TokenStatus';

export const MigrationTokenPane = () => {
  const { data: hasToken, isFetching } = useHasMigrationTokenQuery();
  const [createToken, createTokenResponse] = useCreateMigrationTokenMutation();
  const [deleteToken, deleteTokenResponse] = useDeleteMigrationTokenMutation();

  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <Box display="flex" alignItems="flex-start" padding={2} gap={2} direction="column" backgroundColor="secondary">
          <InfoItem title={t('migrate-to-cloud.migration-token.title', 'Migration token')}>
            <Trans i18nKey="migrate-to-cloud.migration-token.body">
              Your self-managed Grafana instance will require a special authentication token to securely connect to this
              cloud stack.
            </Trans>
          </InfoItem>
          <Text color="secondary">
            <Trans i18nKey="migrate-to-cloud.migration-token.status">
              Current status:{' '}
              <TokenStatus
                hasToken={Boolean(hasToken)}
                isFetching={isFetching || createTokenResponse.isLoading || deleteTokenResponse.isLoading}
              />
            </Trans>
          </Text>
          {hasToken ? (
            <Button
              variant="destructive"
              onClick={() =>
                showModal(DeleteMigrationTokenModal, {
                  hideModal,
                  onConfirm: deleteToken,
                })
              }
              disabled={isFetching || deleteTokenResponse.isLoading}
            >
              <Trans i18nKey="migrate-to-cloud.migration-token.delete-button">Delete this migration token</Trans>
            </Button>
          ) : (
            <Button
              disabled={createTokenResponse.isLoading || isFetching}
              onClick={async () => {
                const response = await createToken();
                if ('data' in response) {
                  showModal(MigrationTokenModal, {
                    hideModal,
                    migrationToken: response.data.token,
                  });
                }
              }}
            >
              {createTokenResponse.isLoading
                ? t('migrate-to-cloud.migration-token.generate-button-loading', 'Generating a migration token...')
                : t('migrate-to-cloud.migration-token.generate-button', 'Generate a migration token')}
            </Button>
          )}
        </Box>
      )}
    </ModalsController>
  );
};
