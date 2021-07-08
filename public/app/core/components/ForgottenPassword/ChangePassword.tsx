import React, { FC, SyntheticEvent } from 'react';
import { Tooltip, Form, Field, Input, VerticalGroup, Button } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { submitButton } from '../Login/LoginForm';
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
            <Input
              autoFocus
              id="new-password"
              type="password"
              {...register('newPassword', {
                required: 'New password is required',
              })}
            />
          </Field>
          <Field label="Confirm new password" invalid={!!errors.confirmNew} error={errors?.confirmNew?.message}>
            <Input
              id="confirm-new-password"
              type="password"
              {...register('confirmNew', {
                required: 'Confirmed password is required',
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
