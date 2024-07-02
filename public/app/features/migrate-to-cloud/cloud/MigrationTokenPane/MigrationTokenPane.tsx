import { useCallback, useState } from 'react';

import { Box, Button, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { useCreateCloudMigrationTokenMutation } from '../../api';
import { TokenErrorAlert } from '../TokenErrorAlert';

import { MigrationTokenModal } from './MigrationTokenModal';
import { TokenStatus } from './TokenStatus';

export const MigrationTokenPane = () => {
  const [showModal, setShowModal] = useState(false);
  const isFetchingStatus = false; // TODO: No API for this yet

  const [createTokenMutation, createTokenResponse] = useCreateCloudMigrationTokenMutation();
  const hasToken = Boolean(createTokenResponse.data?.token);

  const isLoading = isFetchingStatus || createTokenResponse.isLoading; /* || deleteTokenResponse.isLoading */

  const handleGenerateToken = useCallback(async () => {
    const resp = await createTokenMutation();
    if (!('error' in resp)) {
      setShowModal(true);
    }
  }, [createTokenMutation]);

  return (
    <>
      <Box display="flex" alignItems="flex-start" padding={2} gap={2} direction="column" backgroundColor="secondary">
        <Button disabled={isLoading || hasToken} onClick={handleGenerateToken}>
          {createTokenResponse.isLoading
            ? t('migrate-to-cloud.migration-token.generate-button-loading', 'Generating a migration token...')
            : t('migrate-to-cloud.migration-token.generate-button', 'Generate a migration token')}
        </Button>
        {createTokenResponse?.isError ? (
          <TokenErrorAlert />
        ) : (
          <Text color="secondary">
            <Trans i18nKey="migrate-to-cloud.migration-token.status">
              Current status: <TokenStatus hasToken={hasToken} isFetching={isLoading} />
            </Trans>
          </Text>
        )}
      </Box>

      <MigrationTokenModal
        isOpen={showModal}
        hideModal={() => setShowModal(false)}
        migrationToken={createTokenResponse.data?.token}
      />
    </>
  );
};
