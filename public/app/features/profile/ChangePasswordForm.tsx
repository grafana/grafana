import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Field, LinkButton, Stack } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import {
  ValidationLabels,
  strongPasswordValidations,
  strongPasswordValidationRegister,
} from 'app/core/components/ValidationLabels/ValidationLabels';
import config from 'app/core/config';
import { UserDTO } from 'app/types/user';

import { PasswordField } from '../../core/components/PasswordField/PasswordField';

import { ChangePasswordFields } from './types';

export interface Props {
  user: UserDTO;
  isSaving: boolean;
  onChangePassword: (payload: ChangePasswordFields) => void;
  isExternalUser?: boolean;
}

export const ChangePasswordForm = ({ user, onChangePassword, isSaving, isExternalUser = false }: Props) => {
  const [displayValidationLabels, setDisplayValidationLabels] = useState(false);
  const [pristine, setPristine] = useState(true);

  const { disableLoginForm } = config;
  const authSource = user.authLabels?.length && user.authLabels[0];

  if (authSource === 'LDAP' || authSource === 'Auth Proxy') {
    return (
      <p>
        <Trans i18nKey="profile.change-password.ldap-auth-proxy-message">
          You cannot change password when signed in with LDAP or auth proxy.
        </Trans>
      </p>
    );
  }
  if (authSource && disableLoginForm) {
    return (
      <p>
        <Trans i18nKey="profile.change-password.cannot-change-password-message">Password cannot be changed here.</Trans>
      </p>
    );
  }

  const handleSubmit = (payload: ChangePasswordFields) => {
    if (isExternalUser) {
      return;
    }
    onChangePassword(payload);
  };
  const isFormDisabled = isExternalUser;

  return (
    <Form onSubmit={handleSubmit} maxWidth={400}>
      {({ register, errors, getValues, watch }) => {
        const newPassword = watch('newPassword');
        return (
          <>
            {isFormDisabled && (
              <Alert severity="info" title={t('profile.change-password.external-user-title', 'Managed externally')}>
                <Trans i18nKey="profile.change-password.external-user-message">
                  Your password is managed outside of Grafana. Contact your administrator to make changes.
                </Trans>
              </Alert>
            )}
            <Field
              label={t('profile.change-password.old-password-label', 'Old password')}
              invalid={!!errors.oldPassword}
              error={errors?.oldPassword?.message}
            >
              <PasswordField
                id="current-password"
                autoComplete="current-password"
                disabled={isFormDisabled}
                {...register('oldPassword', {
                  required: t('profile.change-password.old-password-required', 'Old password is required'),
                })}
              />
            </Field>

            <Field
              label={t('profile.change-password.new-password-label', 'New password')}
              invalid={!!errors.newPassword}
              error={errors?.newPassword?.message}
            >
              <PasswordField
                id="new-password"
                autoComplete="new-password"
                onFocus={() => setDisplayValidationLabels(true)}
                disabled={isFormDisabled}
                {...register('newPassword', {
                  onBlur: () => setPristine(false),
                  required: t('profile.change-password.new-password-required', 'New password is required'),
                  validate: {
                    strongPasswordValidationRegister,
                    confirm: (v) =>
                      v === getValues().confirmNew ||
                      t('profile.change-password.passwords-must-match', 'Passwords must match'),
                    old: (v) =>
                      v !== getValues().oldPassword ||
                      t(
                        'profile.change-password.new-password-same-as-old',
                        "New password can't be the same as the old one."
                      ),
                  },
                })}
              />
            </Field>
            {displayValidationLabels && (
              <ValidationLabels
                pristine={pristine}
                password={newPassword}
                strongPasswordValidations={strongPasswordValidations}
              />
            )}
            <Field
              label={t('profile.change-password.confirm-password-label', 'Confirm password')}
              invalid={!!errors.confirmNew}
              error={errors?.confirmNew?.message}
            >
              <PasswordField
                id="confirm-new-password"
                autoComplete="new-password"
                disabled={isFormDisabled}
                {...register('confirmNew', {
                  required: t(
                    'profile.change-password.confirm-password-required',
                    'New password confirmation is required'
                  ),
                  validate: (v) =>
                    v === getValues().newPassword ||
                    t('profile.change-password.passwords-must-match', 'Passwords must match'),
                })}
              />
            </Field>
            <Stack>
              <Button variant="primary" disabled={isSaving || isFormDisabled} type="submit">
                <Trans i18nKey="profile.change-password.change-password-button">Change Password</Trans>
              </Button>
              <LinkButton variant="secondary" href={`${config.appSubUrl}/profile`} fill="outline">
                <Trans i18nKey="profile.change-password.cancel-button">Cancel</Trans>
              </LinkButton>
            </Stack>
          </>
        );
      }}
    </Form>
  );
};
