import React, { FC, ReactElement } from 'react';
import { selectors } from '@grafana/e2e-selectors';

import { FormModel } from './LoginCtrl';
import { Button, Form, Input, Field } from '@grafana/ui';
import { css } from 'emotion';

interface Props {
  children: ReactElement;
  onSubmit: (data: FormModel) => void;
  isLoggingIn: boolean;
  passwordHint: string;
  loginHint: string;
}

const wrapperStyles = css`
  width: 100%;
  padding-bottom: 16px;
`;

export const submitButton = css`
  justify-content: center;
  width: 100%;
`;

export const LoginForm: FC<Props> = ({ children, onSubmit, isLoggingIn, passwordHint, loginHint }) => {
  return (
    <div className={wrapperStyles}>
      <Form onSubmit={onSubmit} validateOn="onChange">
        {({ register, errors }) => (
          <>
            <Field label="Email or username" invalid={!!errors.user} error={errors.user?.message}>
              <Input
                autoFocus
                name="user"
                ref={register({ required: 'Email or username is required' })}
                placeholder={loginHint}
                aria-label={selectors.pages.Login.username}
              />
            </Field>
            <Field label="Password" invalid={!!errors.password} error={errors.password?.message}>
              <Input
                name="password"
                type="password"
                placeholder={passwordHint}
                ref={register({ required: 'Password is required' })}
                aria-label={selectors.pages.Login.password}
              />
            </Field>
            <Button aria-label={selectors.pages.Login.submit} className={submitButton} disabled={isLoggingIn}>
              {isLoggingIn ? 'Logging in...' : 'Log in'}
            </Button>
            {children}
          </>
        )}
      </Form>
    </div>
  );
};
