import { useCallback, useState } from 'react';

import { store } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type FetchError, isFetchError } from '@grafana/runtime';
import { Alert, Button, Icon, Stack } from '@grafana/ui';

import {
  isWebAuthnAbort,
  type PasskeyButtonMode,
  PASSKEY_HINT_KEY,
  redirectAfterPasskeyLogin,
  runPasskeyLogin,
} from './passkeyLogin';

interface Props {
  // mode is resolved by usePasskeyButtonMode in the parent; the button is purely presentational. It
  // renders nothing for 'checking'/'hidden' as a defensive guard, though the parent only mounts it
  // when the mode is 'primary' or 'secondary'.
  mode: PasskeyButtonMode;
}

export const PasskeyLoginButton = ({ mode }: Props) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const onClick = useCallback(async () => {
    setErrorMessage(undefined);
    setIsAuthenticating(true);

    try {
      const result = await runPasskeyLogin();
      // Record that this browser has signed in with a passkey before the redirect navigates away, so
      // the next visit shows the primary "Sign in with a passkey" label.
      store.set(PASSKEY_HINT_KEY, true);
      redirectAfterPasskeyLogin(result);
    } catch (err) {
      setIsAuthenticating(false);
      // User dismissed the OS prompt, no credential available, or the browser
      // timed out the ceremony — silent re-enable, no error message.
      if (isWebAuthnAbort(err)) {
        return;
      }
      setErrorMessage(toErrorMessage(err));
    }
  }, []);

  if (mode === 'checking' || mode === 'hidden') {
    return null;
  }

  return (
    <Stack direction="column" width="100%" gap={1}>
      <Button
        variant="secondary"
        fill="outline"
        fullWidth
        disabled={isAuthenticating}
        onClick={onClick}
        data-testid="passkey-login-button"
      >
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name="key-skeleton-alt" />
          {isAuthenticating ? (
            <Trans i18nKey="login.passkey.signing-in">Signing in…</Trans>
          ) : mode === 'primary' ? (
            <Trans i18nKey="login.passkey.sign-in">Sign in with a passkey</Trans>
          ) : (
            <Trans i18nKey="login.passkey.use-another-device">Use a passkey from another device</Trans>
          )}
        </Stack>
      </Button>
      {errorMessage && (
        <Alert
          severity="error"
          title={t('login.passkey.error.title', 'Passkey sign-in failed')}
          onRemove={() => setErrorMessage(undefined)}
          data-testid="passkey-login-error"
        >
          {errorMessage}
        </Alert>
      )}
    </Stack>
  );
};

function toErrorMessage(err: unknown): string {
  if (isFetchError(err)) {
    return (
      mapBackendError(err) ?? t('login.passkey.error.unknown', 'Could not sign in with passkey. Please try again.')
    );
  }
  return t('login.passkey.error.unknown', 'Could not sign in with passkey. Please try again.');
}

function mapBackendError(err: FetchError<undefined | { messageId?: string; message?: string }>): string | undefined {
  // 410 Gone is the contract for an expired/unknown session challenge (spec §4.5).
  if (err.status === 410 || err.data?.messageId === 'passkey.challenge-expired') {
    return t('login.passkey.error.expired', 'That took too long. Please try again.');
  }
  switch (err.data?.messageId) {
    case 'passkey.credential-not-found':
      return t(
        'login.passkey.error.credential-not-found',
        'No passkey was found for this site. Sign in with your password to register one.'
      );
    case 'login-attempt.blocked':
      return t(
        'login.error.blocked',
        'You have exceeded the number of login attempts for this user. Please try again later.'
      );
    default:
      return err.data?.message;
  }
}
