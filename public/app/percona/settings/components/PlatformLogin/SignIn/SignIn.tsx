import React, { FC } from 'react';
import { Form, FormRenderProps } from 'react-final-form';
import { LinkButton, useTheme } from '@grafana/ui';
import validators from 'app/percona/shared/helpers/validators';
import { LoginCredentials, LoginFormProps } from '../types';
import { Messages } from '../PlatformLogin.messages';
import { getStyles } from '../PlatformLogin.styles';
import { PlatformLoginService } from '../PlatformLogin.service';
import { LoaderButton, PasswordInputField, TextInputField } from '@percona/platform-core';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { RESET_PASSWORD_URL } from '../PlatformLogin.constants';

export const SignIn: FC<LoginFormProps> = ({ changeMode, getSettings }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const handleSignInFormSubmit = async (credentials: LoginCredentials) => {
    try {
      await PlatformLoginService.signIn(credentials);

      getSettings();
      appEvents.emit(AppEvents.alertSuccess, [`${Messages.signInSucceeded} ${credentials.email}`]);
    } catch (e) {
      console.error(e);
    }
  };

  const SignInForm: FC<FormRenderProps<LoginCredentials>> = ({ pristine, submitting, valid, handleSubmit }) => (
    <form data-qa="sign-in-form" className={styles.form} onSubmit={handleSubmit} autoComplete="off">
      <legend className={styles.legend}>{Messages.signIn}</legend>
      <TextInputField
        data-qa="sign-in-email-input"
        name="email"
        label={Messages.emailLabel}
        validators={[validators.required, validators.validateEmail]}
        showErrorOnBlur
        parse={(value) => value.trim()}
      />
      <PasswordInputField
        data-qa="sign-in-password-input"
        name="password"
        label={Messages.passwordLabel}
        validators={[validators.required]}
      />
      <LinkButton
        data-qa="sign-in-forgot-password-button"
        type="button"
        size="md"
        variant="link"
        disabled={submitting}
        href={RESET_PASSWORD_URL}
        target="_blank"
        className={styles.forgotPasswordButton}
      >
        {Messages.forgotPassword}
      </LinkButton>
      <LoaderButton
        data-qa="sign-in-submit-button"
        type="submit"
        size="md"
        variant="primary"
        disabled={!valid || submitting || pristine}
        loading={submitting}
        className={styles.submitButton}
      >
        {Messages.signIn}
      </LoaderButton>
      <LoaderButton
        data-qa="sign-in-to-sign-up-button"
        type="button"
        size="md"
        variant="link"
        disabled={submitting}
        onClick={changeMode}
        className={styles.submitButton}
      >
        {Messages.signUp}
      </LoaderButton>
    </form>
  );

  return <Form onSubmit={handleSignInFormSubmit} initialValues={{ email: '', password: '' }} render={SignInForm} />;
};
