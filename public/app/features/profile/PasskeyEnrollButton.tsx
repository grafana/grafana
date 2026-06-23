import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { useCallback, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { type FetchError, getBackendSrv, isFetchError } from '@grafana/runtime';
import { Alert, Button, Field, Icon, Input, Modal, Stack } from '@grafana/ui';

interface Props {
  onEnrolled: () => void;
}

interface BeginResponse {
  sessionID: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

interface FinishRequest {
  sessionID: string;
  name: string;
  response: RegistrationResponseJSON;
}

const BEGIN_URL = '/api/user/passkey/register/begin';
const FINISH_URL = '/api/user/passkey/register/finish';

const defaultName = () => {
  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `Passkey (${date})`;
};

export const PasskeyEnrollButton = ({ onEnrolled }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();

  const reset = useCallback(() => {
    setIsOpen(false);
    setIsEnrolling(false);
    setNameError(undefined);
    setSubmitError(undefined);
    setName(defaultName());
  }, []);

  const enroll = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('user-passkeys.enroll.error.name-required', 'Please enter a name for your passkey.'));
      return;
    }

    setIsEnrolling(true);
    setNameError(undefined);
    setSubmitError(undefined);

    try {
      const begin = await getBackendSrv().post<BeginResponse>(BEGIN_URL, { name: trimmed }, { showErrorAlert: false });
      const response = await startRegistration({ optionsJSON: begin.options });
      const finishBody: FinishRequest = { sessionID: begin.sessionID, name: trimmed, response };
      await getBackendSrv().post(FINISH_URL, finishBody, { showErrorAlert: false });

      onEnrolled();
      reset();
    } catch (err) {
      setIsEnrolling(false);
      if (isWebAuthnAbort(err)) {
        // User dismissed the OS prompt — keep the modal open so they can retry without re-typing the name.
        return;
      }
      setSubmitError(toErrorMessage(err));
    }
  }, [name, onEnrolled, reset]);

  return (
    <>
      <Button variant="primary" icon="plus" onClick={() => setIsOpen(true)} data-testid="passkey-enroll-button">
        <Trans i18nKey="user-passkeys.enroll.button">Add passkey</Trans>
      </Button>

      {isOpen && (
        <Modal
          title={t('user-passkeys.enroll.modal.title', 'Add a passkey')}
          isOpen
          onDismiss={isEnrolling ? () => {} : reset}
        >
          <Stack direction="column" gap={2}>
            {submitError && (
              <Alert
                severity="error"
                title={t('user-passkeys.enroll.error.title', 'Could not register passkey')}
                onRemove={() => setSubmitError(undefined)}
              >
                {submitError}
              </Alert>
            )}
            <Field
              noMargin
              label={t('user-passkeys.enroll.modal.name-label', 'Name')}
              description={t(
                'user-passkeys.enroll.modal.name-description',
                'A label to help you recognise this passkey later, e.g. "Work laptop" or "Yubikey".'
              )}
              invalid={Boolean(nameError)}
              error={nameError}
            >
              <Input
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    enroll();
                  }
                }}
                autoFocus
                disabled={isEnrolling}
                aria-label={t('user-passkeys.enroll.modal.name-input', 'Passkey name')}
              />
            </Field>
            <Stack direction="row" justifyContent="flex-end" gap={1}>
              <Button variant="secondary" fill="outline" onClick={reset} disabled={isEnrolling}>
                <Trans i18nKey="user-passkeys.enroll.modal.cancel">Cancel</Trans>
              </Button>
              <Button variant="primary" onClick={enroll} disabled={isEnrolling || !name.trim()}>
                {isEnrolling ? (
                  <Stack direction="row" gap={1} alignItems="center">
                    <Icon name="fa fa-spinner" />
                    <Trans i18nKey="user-passkeys.enroll.modal.in-progress">Waiting for device…</Trans>
                  </Stack>
                ) : (
                  <Trans i18nKey="user-passkeys.enroll.modal.continue">Continue</Trans>
                )}
              </Button>
            </Stack>
          </Stack>
        </Modal>
      )}
    </>
  );
};

function isWebAuthnAbort(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError');
}

function toErrorMessage(err: unknown): string {
  if (isFetchError(err)) {
    return (
      mapBackendError(err) ?? t('user-passkeys.enroll.error.unknown', 'Could not register passkey. Please try again.')
    );
  }
  return t('user-passkeys.enroll.error.unknown', 'Could not register passkey. Please try again.');
}

function mapBackendError(err: FetchError<undefined | { messageId?: string; message?: string }>): string | undefined {
  if (err.status === 410 || err.data?.messageId === 'passkey.challenge-expired') {
    return t('user-passkeys.enroll.error.expired', 'That took too long. Please try again.');
  }
  if (err.data?.messageId === 'passkey.credential-already-registered') {
    return t('user-passkeys.enroll.error.duplicate', 'This passkey is already registered to your account.');
  }
  return err.data?.message;
}
