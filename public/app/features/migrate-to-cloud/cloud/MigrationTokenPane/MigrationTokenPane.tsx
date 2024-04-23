import React from 'react';

import { Box, Button, ModalsController, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { useCreateCloudMigrationTokenMutation } from '../../api';
import { InfoItem } from '../../shared/InfoItem';
import { TokenErrorAlert } from '../TokenErrorAlert';

import { MigrationTokenModal } from './MigrationTokenModal';
import { TokenStatus } from './TokenStatus';

export const MigrationTokenPane = () => {
  const isFetchingStatus = false; // TODO: No API for this yet

  const [createToken, createTokenResponse] = useCreateCloudMigrationTokenMutation();
  const hasToken = Boolean(createTokenResponse.data?.token);

  const isLoading = isFetchingStatus || createTokenResponse.isLoading; /* || deleteTokenResponse.isLoading */

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

          {createTokenResponse?.isError ? (
            <TokenErrorAlert />
          ) : (
            <Text color="secondary">
              <Trans i18nKey="migrate-to-cloud.migration-token.status">
                Current status: <TokenStatus hasToken={hasToken} isFetching={isLoading} />
              </Trans>
            </Text>
          )}

          <Button
            disabled={isLoading || hasToken}
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
        </Box>
      )}
    </ModalsController>
  );
};
