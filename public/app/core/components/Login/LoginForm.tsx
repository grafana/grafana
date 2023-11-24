import { css } from '@emotion/css';
import React, { ReactElement, useId } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Form, Input, Field } from '@grafana/ui';

import { PasswordField } from '../PasswordField/PasswordField';

import { FormModel } from './LoginCtrl';

interface Props {
  children: ReactElement;
  onSubmit: (data: FormModel) => void;
  isLoggingIn: boolean;
  passwordHint: string;
  loginHint: string;
}

const wrapperStyles = css({
  width: '100%',
  paddingBottom: 16,
});

export const submitButton = css({
  justifyContent: 'center',
  width: '100%',
});

export const LoginForm = ({ children, onSubmit, isLoggingIn, passwordHint, loginHint }: Props) => {
  const usernameId = useId();
  const passwordId = useId();

  return (
    <div className={wrapperStyles}>
      <Form onSubmit={onSubmit} validateOn="onChange">
        {({ register, errors }) => (
          <>
            <Field label="Email or username" invalid={!!errors.user} error={errors.user?.message}>
              <Input
                {...register('user', { required: 'Email or username is required' })}
                id={usernameId}
                autoFocus
                autoCapitalize="none"
                placeholder={loginHint}
                data-testid={selectors.pages.Login.username}
              />
            </Field>
            <Field label="Password" invalid={!!errors.password} error={errors.password?.message}>
              <PasswordField
                {...register('password', { required: 'Password is required' })}
                id={passwordId}
                autoComplete="current-password"
                placeholder={passwordHint}
              />
            </Field>
            <Button
              type="submit"
              data-testid={selectors.pages.Login.submit}
              className={submitButton}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Logging in...' : 'Log in'}
            </Button>
            {children}
          </>
        )}
      </Form>
    </div>
  );
};
