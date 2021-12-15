import { withTypes } from 'react-final-form';
import React, { FC, useRef, useState } from 'react';
import { Button, Spinner, useTheme } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import {
  TextInputField,
  PasswordInputField,
  validators,
  RadioButtonGroupField,
  CheckboxField,
  logger,
} from '@percona/platform-core';
import { FormApi } from 'final-form';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { TestEmailSettings } from './TestEmailSettings/TestEmailSettings';
import { getSettingsStyles } from '../../../Settings.styles';
import { Messages } from '../Communication.messages';
import { getInitialValues, cleanupFormValues } from './Email.utils';
import { emailOptions } from './Email.constants';
import { EmailProps, FormEmailSettings } from './Email.types';
import { EmailAuthType } from 'app/percona/settings/Settings.types';
import { createPortal } from 'react-dom';

export const Email: FC<EmailProps> = ({ updateSettings, settings, testSettings }) => {
  const theme = useTheme();
  const testRef = useRef<HTMLDivElement | null>(null);
  const applyRef = useRef<HTMLDivElement | null>(null);
  const testEmailRef = useRef(settings.test_email);
  const settingsStyles = getSettingsStyles(theme);
  const [loading, setLoading] = useState(false);

  const applyChanges = async (values: FormEmailSettings) => {
    await updateSettings(
      {
        email_alerting_settings: { ...cleanupFormValues(values), test_email: testEmailRef.current },
      },
      setLoading
    );
  };

  const resetUsernameAndPasswordState = (form: FormApi<FormEmailSettings>) => {
    form.resetFieldState('username');
    form.resetFieldState('password');
  };

  const handleTestClick = async (values: FormEmailSettings, email: string) => {
    try {
      await testSettings({ email_alerting_settings: cleanupFormValues(values) }, email);
      appEvents.emit(AppEvents.alertSuccess, [Messages.emailSent]);
    } catch (e) {
      logger.error(e);
    }
  };

  const initialValues = getInitialValues(settings);
  const { Form } = withTypes<FormEmailSettings>();

  return (
    <>
      <Form
        onSubmit={applyChanges}
        initialValues={initialValues}
        render={({ handleSubmit, valid, pristine, values, form }) => (
          <form className={settingsStyles.emailForm} onSubmit={handleSubmit}>
            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.smarthost.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.smarthost.tooltipText}
                link={Messages.fields.smarthost.tooltipLink}
                linkText={Messages.fields.smarthost.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField name="smarthost" validators={[validators.required]} />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.hello.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.hello.tooltipText}
                link={Messages.fields.hello.tooltipLink}
                linkText={Messages.fields.hello.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField validators={[validators.required]} name="hello" />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.from.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.from.tooltipText}
                link={Messages.fields.from.tooltipLink}
                linkText={Messages.fields.from.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField name="from" validators={[validators.required, validators.email]} />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.type.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.type.tooltipText}
                link={Messages.fields.type.tooltipLink}
                linkText={Messages.fields.type.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <RadioButtonGroupField
              inputProps={{
                onInput: () => resetUsernameAndPasswordState(form),
              }}
              className={settingsStyles.authRadioGroup}
              options={emailOptions}
              name="authType"
              fullWidth
            />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.username.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.username.tooltipText}
                link={Messages.fields.username.tooltipLink}
                linkText={Messages.fields.username.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField
              disabled={values.authType === EmailAuthType.NONE}
              validators={values.authType === EmailAuthType.NONE ? [] : [validators.required]}
              name="username"
            />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.password.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.password.tooltipText}
                link={Messages.fields.password.tooltipLink}
                linkText={Messages.fields.password.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <PasswordInputField
              disabled={values.authType === EmailAuthType.NONE}
              validators={values.authType === EmailAuthType.NONE ? [] : [validators.required]}
              name="password"
            />
            <CheckboxField name="requireTls" label="Require TLS" />

            {testRef.current &&
              createPortal(
                <TestEmailSettings
                  onInput={(email) => (testEmailRef.current = email)}
                  onTest={(email) => handleTestClick(values, email)}
                  initialValue={settings.test_email}
                />,
                testRef.current
              )}

            {applyRef.current &&
              createPortal(
                <Button
                  className={settingsStyles.actionButton}
                  type="submit"
                  disabled={!valid || pristine || loading}
                  data-testid="email-settings-submit-button"
                  onClick={handleSubmit}
                >
                  {loading && <Spinner />}
                  {Messages.actionButton}
                </Button>,
                applyRef.current
              )}
          </form>
        )}
      />
      <div ref={(e) => (testRef.current = e)}></div>
      <div ref={(e) => (applyRef.current = e)}></div>
    </>
  );
};
