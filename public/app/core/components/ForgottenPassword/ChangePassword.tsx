import React, { FC, SyntheticEvent } from 'react';
import { Tooltip, Form, Field, Input, VerticalGroup, Button, LinkButton } from '@grafana/ui';
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
              type="password"
              name="newPassword"
              ref={register({
                required: 'New password required',
              })}
            />
          </Field>
          <Field label="Confirm new password" invalid={!!errors.confirmNew} error={errors?.confirmNew?.message}>
            <Input
              type="password"
              name="confirmNew"
              ref={register({
                required: 'Confirmed password is required',
                validate: v => v === getValues().newPassword || 'Passwords must match!',
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
                <LinkButton variant="link" onClick={onSkip} aria-label={selectors.pages.Login.skip}>
                  Skip
                </LinkButton>
              </Tooltip>
            )}
          </VerticalGroup>
        </>
      )}
    </Form>
  );
};
