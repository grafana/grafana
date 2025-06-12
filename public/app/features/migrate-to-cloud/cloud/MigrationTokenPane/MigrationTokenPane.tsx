import { useCallback, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Box, Button, Text } from '@grafana/ui';

import {
  useCreateCloudMigrationTokenMutation,
  useDeleteCloudMigrationTokenMutation,
  useGetCloudMigrationTokenQuery,
} from '../../api';
import { maybeAPIError } from '../../api/errors';
import { TokenErrorAlert } from '../TokenErrorAlert';

import { CreateTokenModal } from './CreateTokenModal';
import { DeleteTokenConfirmationModal } from './DeleteTokenConfirmationModal';
import { TokenStatus } from './TokenStatus';

export const MigrationTokenPane = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const getTokenQuery = useGetCloudMigrationTokenQuery();
  const [createTokenMutation, createTokenResponse] = useCreateCloudMigrationTokenMutation();
  const [deleteTokenMutation, deleteTokenResponse] = useDeleteCloudMigrationTokenMutation();

  const getTokenQueryError = maybeAPIError(getTokenQuery.error);

  // GetCloudMigrationToken returns a 404 error if no token exists.
  // When a token is deleted and the GetCloudMigrationToken query is refreshed, RTKQ will retain
  // both the last successful data ("we have a token!") AND the new error. So we need to explicitly
  // check that we don't have an error AND that we have a token.
  const hasToken = Boolean(getTokenQuery.data?.id) && getTokenQueryError?.statusCode !== 404;
  const isLoading = getTokenQuery.isFetching || createTokenResponse.isLoading;

  const handleGenerateToken = useCallback(async () => {
    reportInteraction('grafana_e2c_generate_token_clicked');

    const resp = await createTokenMutation();

    if (!('error' in resp)) {
      setShowCreateModal(true);
    }
  }, [createTokenMutation]);

  const handleDeleteToken = useCallback(async () => {
    if (!getTokenQuery.data?.id) {
      return;
    }

    reportInteraction('grafana_e2c_delete_token_clicked');
    const resp = await deleteTokenMutation({ uid: getTokenQuery.data.id });
    if (!('error' in resp)) {
      setShowDeleteModal(false);
    }
  }, [deleteTokenMutation, getTokenQuery.data]);

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

        {hasToken ? (
          <Button onClick={() => setShowDeleteModal(true)} variant="destructive">
            {t('migrate-to-cloud.migration-token.delete-button', 'Delete token')}
          </Button>
        ) : (
          <Button disabled={isLoading} onClick={handleGenerateToken}>
            {createTokenResponse.isLoading
              ? t('migrate-to-cloud.migration-token.generate-button-loading', 'Generating a migration token...')
              : t('migrate-to-cloud.migration-token.generate-button', 'Generate a migration token')}
          </Button>
        )}
      </Box>

      <CreateTokenModal
        isOpen={showCreateModal}
        hideModal={() => {
          reportInteraction('grafana_e2c_generated_token_modal_dismissed');
          setShowCreateModal(false);
        }}
        migrationToken={createTokenResponse.data?.token}
      />

      <DeleteTokenConfirmationModal
        isOpen={showDeleteModal}
        onConfirm={handleDeleteToken}
        onDismiss={() => setShowDeleteModal(false)}
        hasError={Boolean(deleteTokenResponse.error)}
      />
    </>
  );
};
