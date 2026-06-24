import { type PublicKeyCredentialCreationOptionsJSON, startRegistration } from '@simplewebauthn/browser';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { Alert, Button, Field, Input, LinkButton, Stack } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { type GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { w3cStandardEmailValidator } from 'app/features/admin/utils';

import { InnerBox, LoginLayout } from '../Login/LoginLayout';
import { isWebAuthnAbort } from '../Login/passkeyLogin';
import { PasswordField } from '../PasswordField/PasswordField';

interface SignupDTO {
  name?: string;
  email: string;
  username: string;
  orgName?: string;
  password?: string;
  code: string;
  confirm?: string;
}

interface CredentialEnrollBeginResponse {
  sessionID: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

interface QueryParams {
  email?: string;
  code?: string;
}

interface Props extends GrafanaRouteComponentProps<{}, QueryParams> {}

// Passwordless mode: the instance has hidden the password login form and enabled passkeys, so signup
// enrols a passkey instead of setting a password. Matches the login page's own gate (disableLoginForm).
function isPasswordless(): boolean {
  return getConfig().disableLoginForm && Boolean(getConfig().passkey?.enabled);
}

function toErrorMessage(err: unknown): string {
  if (isFetchError(err)) {
    if (err.status === 410 || err.data?.messageId === 'passkey.challenge-expired') {
      return t('sign-up.passkey.error-expired', 'That took too long. Please try again.');
    }
    return err.data?.message ?? t('sign-up.passkey.error-unknown', 'Could not create your passkey. Please try again.');
  }
  return t('sign-up.passkey.error-unknown', 'Could not create your passkey. Please try again.');
}

export const SignupPage = ({ queryParams }: Props) => {
  const notifyApp = useAppNotification();
  const passwordless = isPasswordless();
  const webAuthnSupported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const {
    handleSubmit,
    formState: { errors },
    register,
    getValues,
  } = useForm<SignupDTO>({ defaultValues: { email: queryParams.email, code: queryParams.code } });

  // enrollPasskey creates the passwordless user and enrols a passkey via the credential-enroll
  // ceremony, then reloads — finish sets the session cookie, so we land authenticated.
  const enrollPasskey = async (formData: SignupDTO) => {
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      const begin = await getBackendSrv().post<CredentialEnrollBeginResponse>(
        '/api/user/credential-enroll/begin',
        {
          email: formData.email,
          username: formData.email,
          name: formData.name,
          orgName: formData.orgName,
          code: formData.code,
        },
        { showErrorAlert: false }
      );
      const response = await startRegistration({ optionsJSON: begin.options });
      await getBackendSrv().post(
        '/api/user/credential-enroll/finish',
        { sessionID: begin.sessionID, name: t('sign-up.passkey.default-name', 'Passkey'), response },
        { showErrorAlert: false }
      );
      window.location.assign(getConfig().appSubUrl + '/');
    } catch (err) {
      // The user dismissed the OS prompt: let them retry without losing the form.
      if (!isWebAuthnAbort(err)) {
        setSubmitError(toErrorMessage(err));
      }
      setSubmitting(false);
    }
  };

  const onSubmit = async (formData: SignupDTO) => {
    if (formData.name === '') {
      delete formData.name;
    }
    delete formData.confirm;

    if (passwordless) {
      await enrollPasskey(formData);
      return;
    }

    const response = await getBackendSrv()
      .post('/api/user/signup/step2', {
        email: formData.email,
        code: formData.code,
        username: formData.email,
        orgName: formData.orgName,
        password: formData.password,
        name: formData.name,
      })
      .catch((err) => {
        const msg = err.data?.message || err;
        notifyApp.warning(msg);
      });

    if (response.code === 'redirect-to-select-org') {
      window.location.assign(getConfig().appSubUrl + '/profile/select-org?signup=1');
    }
    window.location.assign(getConfig().appSubUrl + '/');
  };

  return (
    <LoginLayout>
      <InnerBox>
        <form onSubmit={handleSubmit(onSubmit)} style={{ width: '100%' }}>
          <Field label={t('sign-up.user-name-label', 'Your name')}>
            <Input
              id="user-name"
              {...register('name')}
              placeholder={t('sign-up.user-name-placeholder', '(optional)')}
            />
          </Field>
          <Field label={t('sign-up.email-label', 'Email')} invalid={!!errors.email} error={errors.email?.message}>
            <Input
              id="email"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: w3cStandardEmailValidator,
                  message: 'Email is invalid',
                },
              })}
              type="email"
            />
          </Field>
          {!getConfig().autoAssignOrg && (
            <Field label={t('sign-up.org-name-label', 'Org. name')}>
              <Input id="org-name" {...register('orgName')} />
            </Field>
          )}
          {getConfig().verifyEmailEnabled && (
            <Field label={t('sign-up.verification-code-label', 'Email verification code (sent to your email)')}>
              <Input id="verification-code" {...register('code')} />
            </Field>
          )}
          {!passwordless && (
            <>
              <Field
                label={t('sign-up.password-label', 'Password')}
                invalid={!!errors.password}
                error={errors?.password?.message}
              >
                <PasswordField
                  id="new-password"
                  autoFocus
                  autoComplete="new-password"
                  {...register('password', { required: 'Password is required' })}
                />
              </Field>
              <Field
                label={t('sign-up.confirm-password-label', 'Confirm password')}
                invalid={!!errors.confirm}
                error={errors?.confirm?.message}
              >
                <PasswordField
                  id="confirm-new-password"
                  autoComplete="new-password"
                  {...register('confirm', {
                    required: 'Confirmed password is required',
                    validate: (v) => v === getValues().password || 'Passwords must match!',
                  })}
                />
              </Field>
            </>
          )}

          {submitError && <Alert severity="error" title={submitError} />}
          {passwordless && !webAuthnSupported && (
            <Alert
              severity="warning"
              title={t(
                'sign-up.passkey.unsupported',
                'This browser does not support passkeys. Use a browser that supports them to sign up.'
              )}
            />
          )}

          <Stack>
            <Button type="submit" disabled={submitting || (passwordless && !webAuthnSupported)}>
              {passwordless ? (
                <Trans i18nKey="sign-up.passkey.submit-button">Create your passkey</Trans>
              ) : (
                <Trans i18nKey="sign-up.submit-button">Submit</Trans>
              )}
            </Button>
            <LinkButton fill="text" href={getConfig().appSubUrl + '/login'}>
              <Trans i18nKey="sign-up.back-button">Back to login</Trans>
            </LinkButton>
          </Stack>
        </form>
      </InnerBox>
    </LoginLayout>
  );
};

export default SignupPage;
