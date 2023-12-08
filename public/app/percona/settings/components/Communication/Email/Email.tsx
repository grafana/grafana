import { FormApi } from 'final-form';
import React, { FC, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { withTypes } from 'react-final-form';

import { AppEvents } from '@grafana/data';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { EmailAuthType } from 'app/percona/settings/Settings.types';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { logger } from 'app/percona/shared/helpers/logger';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { getSettingsStyles } from '../../../Settings.styles';
import { Messages } from '../Communication.messages';

import { emailOptions } from './Email.constants';
import { getStyles } from './Email.styles';
import { EmailProps, FormEmailSettings } from './Email.types';
import { cleanupFormValues, getInitialValues } from './Email.utils';
import { TestEmailSettings } from './TestEmailSettings/TestEmailSettings';

export const Email: FC<EmailProps> = ({ updateSettings, settings, testSettings }) => {
  const testRef = useRef<HTMLDivElement | null>(null);
  const applyRef = useRef<HTMLDivElement | null>(null);
  const testEmailRef = useRef(settings.test_email);
  const settingsStyles = useStyles2(getSettingsStyles);
  const styles = useStyles2(getStyles);
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
          <form className={styles.emailForm} onSubmit={handleSubmit}>
            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.smarthost.label}</span>
              <LinkTooltip
                tooltipContent={Messages.fields.smarthost.tooltipText}
                link={Messages.fields.smarthost.tooltipLink}
                linkText={Messages.fields.smarthost.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField name="smarthost" validators={[validators.required]} />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.hello.label}</span>
              <LinkTooltip
                tooltipContent={Messages.fields.hello.tooltipText}
                link={Messages.fields.hello.tooltipLink}
                linkText={Messages.fields.hello.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField validators={[validators.required]} name="hello" />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.from.label}</span>
              <LinkTooltip
                tooltipContent={Messages.fields.from.tooltipText}
                link={Messages.fields.from.tooltipLink}
                linkText={Messages.fields.from.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField name="from" validators={[validators.required, validators.email]} />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.type.label}</span>
              <LinkTooltip
                tooltipContent={Messages.fields.type.tooltipText}
                link={Messages.fields.type.tooltipLink}
                linkText={Messages.fields.type.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <RadioButtonGroupField
              inputProps={{
                onInput: () => resetUsernameAndPasswordState(form),
              }}
              className={styles.authRadioGroup}
              options={emailOptions}
              name="authType"
              fullWidth
            />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.username.label}</span>
              <LinkTooltip
                tooltipContent={Messages.fields.username.tooltipText}
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
                tooltipContent={Messages.fields.password.tooltipText}
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
