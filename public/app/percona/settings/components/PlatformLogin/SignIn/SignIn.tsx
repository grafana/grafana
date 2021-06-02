import React, { FC } from 'react';
import { Form, FormRenderProps } from 'react-final-form';
import { useTheme } from '@grafana/ui';
import validators from 'app/percona/shared/helpers/validators';
import { Credentials, LoginFormProps } from '../types';
import { Messages } from '../PlatformLogin.messages';
import { getStyles } from '../PlatformLogin.styles';
import { PlatformLoginService } from '../PlatformLogin.service';
import { LoaderButton, PasswordInputField, TextInputField } from '@percona/platform-core';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

export const SignIn: FC<LoginFormProps> = ({ changeMode, getSettings }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const handleSignInFormSubmit = async (credentials: Credentials) => {
    try {
      await PlatformLoginService.signIn(credentials);

      getSettings();
      appEvents.emit(AppEvents.alertSuccess, [`${Messages.signInSucceeded} ${credentials.email}`]);
    } catch (e) {
      console.error(e);
      appEvents.emit(AppEvents.alertError, [Messages.errors.signInFailed]);
    }
  };

  const SignInForm: FC<FormRenderProps<Credentials>> = ({ pristine, submitting, valid, handleSubmit }) => (
    <form data-qa="sign-in-form" className={styles.form} onSubmit={handleSubmit} autoComplete="off">
      <legend className={styles.legend}>{Messages.signIn}</legend>
      <TextInputField
        data-qa="sign-in-email-input"
        name="email"
        label={Messages.emailLabel}
        validators={[validators.required, validators.validateEmail]}
        showErrorOnBlur
      />
      <PasswordInputField
        data-qa="sign-in-password-input"
        name="password"
        label={Messages.passwordLabel}
        validators={[validators.required]}
      />
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
