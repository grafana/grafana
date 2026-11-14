import { useState } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, ConfirmModal, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { CreatePersonalAccessTokenModal } from './CreatePersonalAccessTokenModal';
import { PersonalAccessTokensTable } from './PersonalAccessTokensTable';
import { personalAccessTokensApi } from './api';
import { type CreatePersonalAccessTokenRequest, type PersonalAccessToken } from './types';
import { errorMessage } from './utils';

export function PersonalAccessTokensPage() {
  const {
    value: tokens = [],
    loading,
    error: listError,
    retry,
  } = useAsyncRetry(() => personalAccessTokensApi.list(), []);
  const { value: policy } = useAsync(() => personalAccessTokensApi.getEffectivePolicy().catch(() => undefined), []);
  const disabledByPolicy = policy?.enabled === false;
  const [actionError, setActionError] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [secret, setSecret] = useState('');
  const [toRevoke, setToRevoke] = useState<PersonalAccessToken>();

  const canCreate = contextSrv.hasPermission(AccessControlAction.UsersTokensCreate) && !disabledByPolicy;
  const canRevoke = contextSrv.hasPermission(AccessControlAction.UsersTokensDelete);

  const loadError = actionError ?? (listError ? errorMessage(listError) : undefined);

  const onCreate = async (req: CreatePersonalAccessTokenRequest) => {
    try {
      const res = await personalAccessTokensApi.create(req);
      setCreateError(undefined);
      setSecret(res.token);
      retry();
    } catch (err) {
      setCreateError(errorMessage(err));
    }
  };

  const onCloseCreate = () => {
    // Dropping the secret from state as soon as the modal closes keeps it from lingering in memory.
    setSecret('');
    setCreateError(undefined);
    setCreateOpen(false);
  };

  const onConfirmRevoke = async () => {
    if (!toRevoke) {
      return;
    }
    try {
      await personalAccessTokensApi.revoke(toRevoke.uid);
      retry();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setToRevoke(undefined);
    }
  };

  return (
    <Page navId="profile/personal-access-tokens">
      <Page.Contents isLoading={loading}>
        <Stack direction="column" gap={2}>
          <Stack justifyContent="space-between" alignItems="center">
            <p>
              <Trans i18nKey="personal-access-tokens.description">
                Personal access tokens let scripts and tools act on your behalf through the HTTP API. They can never do
                more than you can, and expire automatically.
              </Trans>
            </p>
            <Button icon="plus" disabled={!canCreate} onClick={() => setCreateOpen(true)}>
              <Trans i18nKey="personal-access-tokens.add">Add token</Trans>
            </Button>
          </Stack>
          {disabledByPolicy && (
            <Alert
              severity="warning"
              title={t(
                'personal-access-tokens.disabled-title',
                'Personal access tokens are disabled by your administrator'
              )}
            >
              <Trans i18nKey="personal-access-tokens.disabled-body">
                You cannot create new tokens. Existing tokens do not work, but you can still revoke them.
              </Trans>
            </Alert>
          )}
          {loadError && (
            <Alert severity="error" title={t('personal-access-tokens.load-error', 'Request failed')}>
              {loadError}
            </Alert>
          )}
          <PersonalAccessTokensTable tokens={tokens} canRevoke={canRevoke} onRevoke={setToRevoke} />
        </Stack>
        <CreatePersonalAccessTokenModal
          isOpen={createOpen}
          token={secret}
          error={createError}
          onCreate={onCreate}
          onClose={onCloseCreate}
        />
        <ConfirmModal
          isOpen={Boolean(toRevoke)}
          title={t('personal-access-tokens.revoke-title', 'Revoke token')}
          body={t(
            'personal-access-tokens.revoke-body',
            'Revoking token {{name}} is permanent and immediately stops it from working.',
            { name: toRevoke?.name ?? '' }
          )}
          confirmText={t('personal-access-tokens.revoke-confirm', 'Revoke')}
          onConfirm={onConfirmRevoke}
          onDismiss={() => setToRevoke(undefined)}
        />
      </Page.Contents>
    </Page>
  );
}

export default PersonalAccessTokensPage;
