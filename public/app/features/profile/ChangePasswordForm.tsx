import { css } from '@emotion/css';
import React, { FC } from 'react';

import { Button, Field, Form, HorizontalGroup, LinkButton } from '@grafana/ui';
import config from 'app/core/config';
import { UserDTO } from 'app/types';

import { PasswordField } from '../../core/components/PasswordField/PasswordField';

import { ChangePasswordFields } from './types';

export interface Props {
  user: UserDTO;
  isSaving: boolean;
  onChangePassword: (payload: ChangePasswordFields) => void;
}

export const ChangePasswordForm: FC<Props> = ({ user, onChangePassword, isSaving }) => {
  const { disableLoginForm } = config;
  const authSource = user.authLabels?.length && user.authLabels[0];

  if (authSource === 'LDAP' || authSource === 'Auth Proxy') {
    return <p>You cannot change password when signed in with LDAP or auth proxy.</p>;
  }
  if (authSource && disableLoginForm) {
    return <p>Password cannot be changed here.</p>;
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
              <Field label="Old password" invalid={!!errors.oldPassword} error={errors?.oldPassword?.message}>
                <PasswordField
                  id="current-password"
                  autoComplete="current-password"
                  {...register('oldPassword', { required: 'Old password is required' })}
                />
              </Field>

              <Field label="New password" invalid={!!errors.newPassword} error={errors?.newPassword?.message}>
                <PasswordField
                  id="new-password"
                  autoComplete="new-password"
                  {...register('newPassword', {
                    required: 'New password is required',
                    validate: {
                      confirm: (v) => v === getValues().confirmNew || 'Passwords must match',
                      old: (v) => v !== getValues().oldPassword || `New password can't be the same as the old one.`,
                    },
                  })}
                />
              </Field>

              <Field label="Confirm password" invalid={!!errors.confirmNew} error={errors?.confirmNew?.message}>
                <PasswordField
                  id="confirm-new-password"
                  autoComplete="new-password"
                  {...register('confirmNew', {
                    required: 'New password confirmation is required',
                    validate: (v) => v === getValues().newPassword || 'Passwords must match',
                  })}
                />
              </Field>
              <HorizontalGroup>
                <Button variant="primary" disabled={isSaving} type="submit">
                  Change Password
                </Button>
                <LinkButton variant="secondary" href={`${config.appSubUrl}/profile`} fill="outline">
                  Cancel
                </LinkButton>
              </HorizontalGroup>
            </>
          );
        }}
      </Form>
    </div>
  );
};
