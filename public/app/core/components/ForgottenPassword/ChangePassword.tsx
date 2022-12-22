import React, { FC, SyntheticEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Tooltip, Form, Field, VerticalGroup, Button } from '@grafana/ui';

import { submitButton } from '../Login/LoginForm';
import { PasswordField } from '../PasswordField/PasswordField';
interface Props {
  onSubmit: (pw: string) => void;
  onSkip?: (event?: SyntheticEvent) => void;
}

interface PasswordDTO {
  newPassword: string;
  confirmNew: string;
}

export const ChangePassword: FC<Props> = ({ onSubmit, onSkip }) => {
  const submit = (passwords: PasswordDTO) => {
    onSubmit(passwords.newPassword);
  };
  return (
    <Form onSubmit={submit}>
      {({ errors, register, getValues }) => (
        <>
          <Field label="New password" invalid={!!errors.newPassword} error={errors?.newPassword?.message}>
            <PasswordField
              id="new-password"
              autoFocus
              autoComplete="new-password"
              {...register('newPassword', { required: 'New Password is required' })}
            />
          </Field>
          <Field label="Confirm new password" invalid={!!errors.confirmNew} error={errors?.confirmNew?.message}>
            <PasswordField
              id="confirm-new-password"
              autoComplete="new-password"
              {...register('confirmNew', {
                required: 'Confirmed Password is required',
                validate: (v: string) => v === getValues().newPassword || 'Passwords must match!',
              })}
            />
          </Field>
          <VerticalGroup>
            <Button type="submit" className={submitButton}>
              Submit
            </Button>

            {onSkip && (
              <Tooltip
                content="If you skip you will be prompted to change password next time you log in."
                placement="bottom"
              >
                <Button fill="text" onClick={onSkip} type="button" aria-label={selectors.pages.Login.skip}>
                  Skip
                </Button>
              </Tooltip>
            )}
          </VerticalGroup>
        </>
      )}
    </Form>
  );
};
