import { useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { useFlagPersonalAccessTokens } from '@grafana/runtime/internal';
import { Alert, Button, ConfirmModal, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { PersonalAccessTokensTable } from 'app/features/personal-access-tokens/PersonalAccessTokensTable';
import { personalAccessTokensApi } from 'app/features/personal-access-tokens/api';
import { type PersonalAccessToken } from 'app/features/personal-access-tokens/types';
import { errorMessage } from 'app/features/personal-access-tokens/utils';
import { AccessControlAction } from 'app/types/accessControl';

interface Props {
  userId: number;
}

export function UserPersonalAccessTokens({ userId }: Props) {
  const enabled = useFlagPersonalAccessTokens();
  const canRead = contextSrv.hasPermission(AccessControlAction.UsersTokensRead);
  const canRevoke = contextSrv.hasPermission(AccessControlAction.UsersTokensDelete);
  const [toRevoke, setToRevoke] = useState<PersonalAccessToken>();
  const [revokeAll, setRevokeAll] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const {
    value: tokens = [],
    error: listError,
    retry,
  } = useAsyncRetry(
    async () => (enabled && canRead ? personalAccessTokensApi.listForUser(userId) : []),
    [enabled, canRead, userId]
  );

  if (!enabled || !canRead) {
    return null;
  }

  const active = tokens.filter((tok) => !tok.revokedAt);
  const error = actionError ?? (listError ? errorMessage(listError) : undefined);

  const run = async (revoke: PersonalAccessToken[]) => {
    try {
      setActionError(undefined);
      for (const tok of revoke) {
        await personalAccessTokensApi.revokeForUser(userId, tok.uid);
      }
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setToRevoke(undefined);
      setRevokeAll(false);
      retry();
    }
  };

  return (
    <section>
      <Stack justifyContent="space-between" alignItems="center">
        <h3>
          <Trans i18nKey="admin.user-personal-access-tokens.heading">Personal access tokens</Trans>
        </h3>
        {canRevoke && active.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setRevokeAll(true)}>
            <Trans i18nKey="admin.user-personal-access-tokens.revoke-all">Revoke all tokens</Trans>
          </Button>
        )}
      </Stack>
      {error && (
        <Alert severity="error" title={t('admin.user-personal-access-tokens.error', 'Request failed')}>
          {error}
        </Alert>
      )}
      <PersonalAccessTokensTable tokens={tokens} canRevoke={canRevoke} onRevoke={setToRevoke} />
      <ConfirmModal
        isOpen={Boolean(toRevoke)}
        title={t('admin.user-personal-access-tokens.revoke-title', 'Revoke token')}
        body={t(
          'admin.user-personal-access-tokens.revoke-body',
          'Revoking token {{name}} is permanent and immediately stops it from working.',
          { name: toRevoke?.name }
        )}
        confirmText={t('admin.user-personal-access-tokens.revoke-confirm', 'Revoke')}
        onConfirm={() => run(toRevoke ? [toRevoke] : [])}
        onDismiss={() => setToRevoke(undefined)}
      />
      <ConfirmModal
        isOpen={revokeAll}
        title={t('admin.user-personal-access-tokens.revoke-all-title', 'Revoke all tokens')}
        body={t(
          'admin.user-personal-access-tokens.revoke-all-body',
          'All active personal access tokens of this user will be permanently revoked.'
        )}
        confirmText={t('admin.user-personal-access-tokens.revoke-all-confirm', 'Revoke all')}
        onConfirm={() => run(active)}
        onDismiss={() => setRevokeAll(false)}
      />
    </section>
  );
}
