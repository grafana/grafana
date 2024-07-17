import { useCallback, useState } from 'react';

import { isFetchError } from '@grafana/runtime';
import { Box, Button, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { useCreateCloudMigrationTokenMutation, useGetCloudMigrationTokenQuery } from '../../api';
import { TokenErrorAlert } from '../TokenErrorAlert';

import { MigrationTokenModal } from './MigrationTokenModal';
import { TokenStatus } from './TokenStatus';

// TODO: candidate to hoist and share
function maybeAPIError(err: unknown) {
  console.log('maybe api error', err);
  if (!isFetchError<unknown>(err) || typeof err.data !== 'object' || !err.data) {
    return null;
  }

  const data = err?.data;

  const message = 'message' in data && typeof data.message === 'string' ? data.message : null;
  const messageId = 'messageId' in data && typeof data.messageId === 'string' ? data.messageId : null;
  const statusCode = 'statusCode' in data && typeof data.statusCode === 'number' ? data.statusCode : null;

  if (!message || !messageId || !statusCode) {
    return null;
  }

  return { message, messageId, statusCode };
}

export const MigrationTokenPane = () => {
  const [showModal, setShowModal] = useState(false);
  const getTokenQuery = useGetCloudMigrationTokenQuery();
  const [createTokenMutation, createTokenResponse] = useCreateCloudMigrationTokenMutation();

  console.log('getTokenQuery', getTokenQuery);
  const getTokenQueryError = maybeAPIError(getTokenQuery.error);
  console.log('getTokenQueryError', getTokenQueryError);

  const hasToken = Boolean(createTokenResponse.data?.token) || Boolean(getTokenQuery.data?.id);
  const isLoading = getTokenQuery.isFetching || createTokenResponse.isLoading;

  const handleGenerateToken = useCallback(async () => {
    const resp = await createTokenMutation();
    if (!('error' in resp)) {
      setShowModal(true);
    }
  }, [createTokenMutation]);

  return (
    <>
      <Box display="flex" alignItems="flex-start" direction="column" gap={2}>
        {createTokenResponse?.isError ? (
          <TokenErrorAlert />
        ) : (
          <Text color="secondary">
            <Trans i18nKey="migrate-to-cloud.migration-token.status">
              Current status:{' '}
              <TokenStatus hasToken={hasToken} isFetching={isLoading} errorMessageId={getTokenQueryError?.messageId} />
            </Trans>
          </Text>
        )}

        <Button disabled={isLoading || hasToken} onClick={handleGenerateToken}>
          {createTokenResponse.isLoading
            ? t('migrate-to-cloud.migration-token.generate-button-loading', 'Generating a migration token...')
            : t('migrate-to-cloud.migration-token.generate-button', 'Generate a migration token')}
        </Button>
      </Box>

      <MigrationTokenModal
        isOpen={showModal}
        hideModal={() => setShowModal(false)}
        migrationToken={createTokenResponse.data?.token}
      />
    </>
  );
};
