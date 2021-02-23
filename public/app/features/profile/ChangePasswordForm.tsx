import React, { FC } from 'react';
import config from 'app/core/config';
import { UserDTO } from 'app/types';
import { Button, LinkButton, Form, Field, Input, HorizontalGroup } from '@grafana/ui';
import { ChangePasswordFields } from 'app/core/utils/UserProvider';
import { css } from 'emotion';

export interface Props {
  user: UserDTO;
  isSaving: boolean;
  onChangePassword: (payload: ChangePasswordFields) => void;
}

export const ChangePasswordForm: FC<Props> = ({ user, onChangePassword, isSaving }) => {
  const { ldapEnabled, authProxyEnabled, disableLoginForm } = config;
  const authSource = user.authLabels?.length && user.authLabels[0];

  if (ldapEnabled || authProxyEnabled) {
    return <p>You cannot change password when ldap or auth proxy authentication is enabled.</p>;
  }
  if (authSource && disableLoginForm) {
    return <p>Password cannot be changed here!</p>;
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
                <Input type="password" name="oldPassword" ref={register({ required: 'Old password is required' })} />
              </Field>

              <Field label="New password" invalid={!!errors.newPassword} error={errors?.newPassword?.message}>
                <Input
                  type="password"
                  name="newPassword"
                  ref={register({
                    required: 'New password is required',
                    validate: {
                      confirm: (v) => v === getValues().confirmNew || 'Passwords must match',
                      old: (v) => v !== getValues().oldPassword || `New password can't be the same as the old one.`,
                    },
                  })}
                />
              </Field>

              <Field label="Confirm password" invalid={!!errors.confirmNew} error={errors?.confirmNew?.message}>
                <Input
                  type="password"
                  name="confirmNew"
                  ref={register({
                    required: 'New password confirmation is required',
                    validate: (v) => v === getValues().newPassword || 'Passwords must match',
                  })}
                />
              </Field>
              <HorizontalGroup>
                <Button variant="primary" disabled={isSaving}>
                  Change Password
                </Button>
                <LinkButton variant="secondary" href={`${config.appSubUrl}/profile`}>
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
