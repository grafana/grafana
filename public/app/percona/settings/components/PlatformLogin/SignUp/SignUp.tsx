import React, { FC } from 'react';
import { Form, FormRenderProps } from 'react-final-form';
import { LinkButton, useTheme } from '@grafana/ui';
import validators from 'app/percona/shared/helpers/validators';
import { SignUpCredentials, LoginFormProps } from '../types';
import { Messages } from '../PlatformLogin.messages';
import { getStyles } from '../PlatformLogin.styles';
import { PlatformLoginService } from '../PlatformLogin.service';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../PlatformLogin.constants';
import { CheckboxField, LoaderButton, TextInputField } from '@percona/platform-core';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

export const SignUp: FC<LoginFormProps> = ({ changeMode, getSettings }) => {
  const styles = getStyles(useTheme());

  const handleSignUpFormSubmit = async (credentials: SignUpCredentials) => {
    try {
      await PlatformLoginService.signUp(credentials);

      getSettings();
      appEvents.emit(AppEvents.alertSuccess, [Messages.signUpSucceeded]);
    } catch (e) {
      console.error(e);
      appEvents.emit(AppEvents.alertError, [Messages.errors.signUpFailed]);
    }
  };

  const CheckboxLabel: FC = () => (
    <span data-qa="sign-up-agreement-checkbox-label" className={styles.checkboxLabel}>
      {`${Messages.agreementFirstPart} `}
      <LinkButton className={styles.link} variant="link" href={TERMS_OF_SERVICE_URL}>
        {Messages.termsOfService}
      </LinkButton>
      {` ${Messages.agreementSecondPart} `}
      <LinkButton className={styles.link} variant="link" href={PRIVACY_POLICY_URL}>
        {Messages.privacyPolicy}
      </LinkButton>
    </span>
  );

  const SignUpForm: FC<FormRenderProps<SignUpCredentials>> = ({ pristine, submitting, valid, handleSubmit }) => (
    <form data-qa="sign-up-form" className={styles.form} onSubmit={handleSubmit}>
      <legend className={styles.legend}>{Messages.signUp}</legend>
      <TextInputField
        data-qa="sign-up-email-input"
        name="email"
        label={Messages.emailLabel}
        validators={[validators.required, validators.validateEmail]}
        showErrorOnBlur
      />
      <TextInputField
        data-qa="sign-up-first-name-input"
        name="firstName"
        label={Messages.firstNameLabel}
        validators={[validators.required]}
        showErrorOnBlur
      />
      <TextInputField
        data-qa="sign-up-last-name-input"
        name="lastName"
        label={Messages.lastNameLabel}
        validators={[validators.required]}
        showErrorOnBlur
      />
      <CheckboxField
        label={<CheckboxLabel />}
        data-qa="sign-up-agreement-checkbox"
        validators={[validators.requiredTrue]}
        name="agreement"
      />
      <LoaderButton
        data-qa="sign-up-submit-button"
        type="submit"
        size="md"
        variant="primary"
        disabled={!valid || submitting || pristine}
        loading={submitting}
        className={styles.submitButton}
      >
        {Messages.signUp}
      </LoaderButton>
      <LoaderButton
        data-qa="sign-up-to-sign-in-button"
        type="button"
        size="md"
        variant="link"
        disabled={submitting}
        onClick={changeMode}
        className={styles.submitButton}
      >
        {Messages.toSignIn}
      </LoaderButton>
    </form>
  );

  return <Form onSubmit={handleSignUpFormSubmit} render={SignUpForm} />;
};
