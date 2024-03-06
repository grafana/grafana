import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Form, HorizontalGroup, Icon, LinkButton, Text, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
import { UserDTO } from 'app/types';

import { PasswordField } from '../../core/components/PasswordField/PasswordField';

import { ChangePasswordFields } from './types';

export interface Props {
  user: UserDTO;
  isSaving: boolean;
  onChangePassword: (payload: ChangePasswordFields) => void;
}

interface StrongPasswordValidation {
  message: string;
  validation: (value: string) => boolean;
}

const strongPasswordValidations: StrongPasswordValidation[] = [
  {
    message: 'At least 12 characters',
    validation: (value: string) => value.length >= 12,
  },
  {
    message: 'One uppercase letter',
    validation: (value: string) => /[A-Z]+/.test(value),
  },
  {
    message: 'One lowercase letter',
    validation: (value: string) => /[a-z]+/.test(value),
  },
  {
    message: 'One number',
    validation: (value: string) => /[0-9]+/.test(value),
  },
  {
    message: 'One symbol',
    validation: (value: string) => /[\W]/.test(value),
  },
];

export const ChangePasswordForm = ({ user, onChangePassword, isSaving }: Props) => {
  const [displayValidationLabels, setDisplayValidationLabels] = useState(false);
  const [pristine, setPristine] = useState(true);
  const [newPassword, setNewPassword] = useState('');

  const { disableLoginForm } = config; // TODO add feature flag
  const authSource = user.authLabels?.length && user.authLabels[0];

  const validationLabel = (index: number, message: string, validation: () => {}) => {
    const result = newPassword.length > 0 && validation();

    const iconName = result || pristine ? 'check' : 'exclamation-triangle';
    const textColor = result ? 'secondary' : pristine ? 'primary' : 'error';

    let iconClassName = undefined;
    if (result) {
      iconClassName = styles.icon.valid;
    } else if (pristine) {
      iconClassName = styles.icon.pending;
    } else {
      iconClassName = styles.icon.error;
    }

    return (
      displayValidationLabels && (
        <div key={index} className={styles.label}>
          <Icon className={styles.icon.style + ' ' + iconClassName} name={iconName} />
          <Text color={textColor}>{message}</Text>
        </div>
      )
    );
  };

  const strongPasswordValidation = (value: string) => {
    return (
      strongPasswordValidations.every((validation) => validation.validation(value)) ||
      t(
        'profile.change-password.strong-password-validation',
        'Password does not comply with the strong password policy'
      )
    );
  };

  const styles = useStyles2(getStyles);

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

  return (
    <div
      className={css`
        max-width: 400px;
      `}
    >
      <Form onSubmit={onChangePassword}>
        {({ register, errors, getValues }) => {
          return (
            <>
              <Field
                label={t('profile.change-password.old-password-label', 'Old password')}
                invalid={!!errors.oldPassword}
                error={errors?.oldPassword?.message}
              >
                <PasswordField
                  id="current-password"
                  autoComplete="current-password"
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
                  value={newPassword}
                  {...register('newPassword', {
                    onBlur: () => setPristine(false),
                    onChange: (e) => setNewPassword(e.target.value),
                    required: t('profile.change-password.new-password-required', 'New password is required'),
                    validate: {
                      strongPasswordValidation: strongPasswordValidation,
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
              <div className={styles.labelContainer}>
                {strongPasswordValidations.map((validation, index) =>
                  validationLabel(index, validation.message, () => validation.validation(newPassword))
                )}
              </div>
              <Field
                label={t('profile.change-password.confirm-password-label', 'Confirm password')}
                invalid={!!errors.confirmNew}
                error={errors?.confirmNew?.message}
              >
                <PasswordField
                  id="confirm-new-password"
                  autoComplete="new-password"
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
              <HorizontalGroup>
                <Button variant="primary" disabled={isSaving} type="submit">
                  <Trans i18nKey="profile.change-password.change-password-button">Change Password</Trans>
                </Button>
                <LinkButton variant="secondary" href={`${config.appSubUrl}/profile`} fill="outline">
                  <Trans i18nKey="profile.change-password.cancel-button">Cancel</Trans>
                </LinkButton>
              </HorizontalGroup>
            </>
          );
        }}
      </Form>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    label: css({
      display: 'flex',
      marginTop: theme.spacing(1),
    }),
    labelContainer: css({
      marginBottom: theme.spacing(2),
    }),
    hidden: css({
      display: 'none',
    }),
    icon: {
      style: css({
        marginRight: theme.spacing(1),
      }),
      valid: css({
        color: theme.colors.success.text,
      }),
      pending: css({
        color: theme.colors.secondary.text,
      }),
      error: css({
        color: theme.colors.error.text,
      }),
    },
  };
};
