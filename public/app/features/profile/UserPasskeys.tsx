import { css } from '@emotion/css';
import { memo, useCallback, useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import {
  Alert,
  Button,
  ConfirmModal,
  Icon,
  IconButton,
  Input,
  LoadingPlaceholder,
  ScrollContainer,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { formatDate } from 'app/core/internationalization/dates';

import { PasskeyEnrollButton } from './PasskeyEnrollButton';

export interface UserPasskey {
  id: number;
  name: string;
  created: string;
  lastUsed?: string;
  credentialId: string;
  userHandle: string;
}

const LIST_URL = '/api/user/passkey/credentials';

export const UserPasskeys = memo(() => {
  const styles = useStyles2(getStyles);
  const [passkeys, setPasskeys] = useState<UserPasskey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<number | undefined>();
  const [pendingDelete, setPendingDelete] = useState<UserPasskey | undefined>();

  const load = useCallback(async (): Promise<UserPasskey[]> => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await getBackendSrv().get<UserPasskey[]>(LIST_URL);
      const creds = result ?? [];
      setPasskeys(creds);
      return creds;
    } catch (err) {
      // Treat load failures as an empty list — the empty state is friendlier than
      // a blocking alert, and it's the right UX whether the user has no passkeys
      // or the endpoint is temporarily unreachable. Mutation errors (rename/delete)
      // still surface via the alert below.
      console.error('Failed to load passkeys', err);
      setPasskeys([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rename = useCallback(
    async (id: number, name: string) => {
      try {
        await getBackendSrv().patch(`${LIST_URL}/${id}`, { name });
        setEditingId(undefined);
        await load();
      } catch (err) {
        setError(t('user-passkeys.error.rename', 'Could not rename passkey.'));
      }
    },
    [load]
  );

  const remove = useCallback(
    async (id: number) => {
      // Capture the user handle from the current list before the delete so the
      // signal call still has it even when the last credential is being removed.
      const userHandle = passkeys[0]?.userHandle;
      try {
        await getBackendSrv().delete(`${LIST_URL}/${id}`);
        setPendingDelete(undefined);
        const remaining = await load();
        signalAcceptedCredentials(userHandle, remaining);
      } catch (err) {
        setError(t('user-passkeys.error.delete', 'Could not delete passkey.'));
      }
    },
    [load, passkeys]
  );

  if (isLoading) {
    return <LoadingPlaceholder text={<Trans i18nKey="user-passkeys.loading">Loading passkeys...</Trans>} />;
  }

  return (
    <div className={styles.wrapper}>
      <div className="page-sub-heading">
        <Text variant="h3" element="h2">
          <Trans i18nKey="user-passkeys.heading">Passkeys</Trans>
        </Text>
      </div>

      {error && <Alert severity="error" title={error} onRemove={() => setError(undefined)} />}

      {passkeys.length === 0 ? (
        <Text color="secondary">
          <Trans i18nKey="user-passkeys.empty">You haven&apos;t registered any passkeys yet.</Trans>
        </Text>
      ) : (
        <ScrollContainer overflowY="visible" overflowX="auto" width="100%">
          <table className="filter-table form-inline" data-testid="user-passkeys-table">
            <thead>
              <tr>
                <th>
                  <Trans i18nKey="user-passkeys.name-column">Name</Trans>
                </th>
                <th>
                  <Trans i18nKey="user-passkeys.created-column">Registered</Trans>
                </th>
                <th>
                  <Trans i18nKey="user-passkeys.last-used-column">Last used</Trans>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {passkeys.map((passkey) => (
                <tr key={passkey.id}>
                  <td>
                    {editingId === passkey.id ? (
                      <PasskeyNameEditor
                        initialValue={passkey.name}
                        onSave={(name) => rename(passkey.id, name)}
                        onCancel={() => setEditingId(undefined)}
                      />
                    ) : (
                      <Stack direction="row" gap={1} alignItems="center">
                        <span>{passkey.name}</span>
                        <IconButton
                          name="pen"
                          size="sm"
                          tooltip={t('user-passkeys.rename', 'Rename passkey')}
                          aria-label={t('user-passkeys.rename', 'Rename passkey')}
                          onClick={() => setEditingId(passkey.id)}
                        />
                      </Stack>
                    )}
                  </td>
                  <td>{formatDate(passkey.created, { dateStyle: 'long' })}</td>
                  <td>
                    {passkey.lastUsed ? (
                      formatDate(passkey.lastUsed, { dateStyle: 'long' })
                    ) : (
                      <Text color="secondary">
                        <Trans i18nKey="user-passkeys.never-used">Never</Trans>
                      </Text>
                    )}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="destructive"
                      tooltip={t('user-passkeys.delete', 'Delete passkey')}
                      onClick={() => setPendingDelete(passkey)}
                      aria-label={t('user-passkeys.delete', 'Delete passkey')}
                    >
                      <Icon name="trash-alt" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollContainer>
      )}

      <div className={styles.actions}>
        <PasskeyEnrollButton onEnrolled={load} />
      </div>

      {pendingDelete && (
        <ConfirmModal
          isOpen
          title={t('user-passkeys.delete-modal.title', 'Delete passkey?')}
          body={t(
            'user-passkeys.delete-modal.body',
            'You will not be able to sign in with "{{name}}" again. This cannot be undone.',
            { name: pendingDelete.name }
          )}
          confirmationText={t('user-passkeys.delete-modal.confirmation', 'Delete')}
          confirmText={t('user-passkeys.delete-modal.confirm', 'Delete')}
          dismissText={t('user-passkeys.delete-modal.cancel', 'Cancel')}
          onConfirm={() => remove(pendingDelete.id)}
          onDismiss={() => setPendingDelete(undefined)}
        />
      )}
    </div>
  );
});

UserPasskeys.displayName = 'UserPasskeys';

interface EditorProps {
  initialValue: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

const PasskeyNameEditor = ({ initialValue, onSave, onCancel }: EditorProps) => {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialValue;

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Input
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSave) {
            onSave(trimmed);
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        autoFocus
        aria-label={t('user-passkeys.name-input', 'Passkey name')}
      />
      <IconButton
        name="check"
        size="sm"
        disabled={!canSave}
        tooltip={t('user-passkeys.save', 'Save')}
        aria-label={t('user-passkeys.save', 'Save')}
        onClick={() => onSave(trimmed)}
      />
      <IconButton
        name="times"
        size="sm"
        tooltip={t('user-passkeys.cancel', 'Cancel')}
        aria-label={t('user-passkeys.cancel', 'Cancel')}
        onClick={onCancel}
      />
    </Stack>
  );
};

// signalAcceptedCredentials reports the still-valid credentials to the browser via the WebAuthn
// Signal API (signalAllAcceptedCredentials, ~Chrome 125+) so a deleted passkey can be dropped from
// autofill. This is strictly best-effort, on two levels: it is a silent no-op when the browser lacks
// the API or rpId/userHandle is missing, AND even when the call succeeds the actual pruning is up to
// the passkey provider. Google Password Manager honours the signal; many third-party managers
// (1Password, Bitwarden, iCloud Keychain, etc.) currently ignore it, so the deleted passkey may still
// linger there. Deletion on the server always succeeds regardless — this only nudges the client.
function signalAcceptedCredentials(userHandle: string | undefined, creds: UserPasskey[]) {
  const rpId = config.passkey?.rpId;
  if (!rpId || !userHandle) {
    return;
  }

  // The Signal API is not in the standard TS lib yet (~Chrome 125+). Feature-detect via Reflect
  // so we can call it without any type assertions — the function is invoked dynamically.
  const signal = Reflect.get(window.PublicKeyCredential ?? {}, 'signalAllAcceptedCredentials');
  if (typeof signal !== 'function') {
    return;
  }

  const opts = { rpId, userId: userHandle, allAcceptedCredentialIds: creds.map((c) => c.credentialId) };
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  void Promise.resolve(signal(opts)).catch(() => {});
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    maxWidth: '100%',
  }),
  actions: css({
    marginTop: theme.spacing(2),
  }),
});
