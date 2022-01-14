import { Form } from 'react-final-form';
import { Button, Spinner, useTheme } from '@grafana/ui';
import React, { FC, useState } from 'react';
import { TextInputField, PasswordInputField, validators } from '@percona/platform-core';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { getSettingsStyles } from '../../../Settings.styles';
import { Messages } from '../Communication.messages';
import { LoadingCallback } from '../../../Settings.service';
import { EmailSettings } from '../../../Settings.types';

export interface EmailProps {
  settings: EmailSettings;
  updateSettings: (body: any, callback: LoadingCallback) => void;
}

export const Email: FC<EmailProps> = ({ updateSettings, settings }) => {
  const theme = useTheme();
  const settingsStyles = getSettingsStyles(theme);
  const [loading, setLoading] = useState(false);

  const applyChanges = (values: EmailSettings) => {
    updateSettings(
      {
        email_alerting_settings: values,
      },
      setLoading
    );
  };

  return (
    <>
      <Form
        onSubmit={applyChanges}
        initialValues={settings}
        render={({ handleSubmit, valid, pristine }) => (
          <form onSubmit={handleSubmit}>
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
              <span>{Messages.fields.from.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.from.tooltipText}
                link={Messages.fields.from.tooltipLink}
                linkText={Messages.fields.from.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField name="from" validators={[validators.required]} />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.username.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.username.tooltipText}
                link={Messages.fields.username.tooltipLink}
                linkText={Messages.fields.username.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField name="username" />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.password.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.password.tooltipText}
                link={Messages.fields.password.tooltipLink}
                linkText={Messages.fields.password.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <PasswordInputField name="password" />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.hello.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.hello.tooltipText}
                link={Messages.fields.hello.tooltipLink}
                linkText={Messages.fields.hello.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField name="hello" />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.identity.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.identity.tooltipText}
                link={Messages.fields.identity.tooltipLink}
                linkText={Messages.fields.identity.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField name="identity" />

            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.secret.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.secret.tooltipText}
                link={Messages.fields.secret.tooltipLink}
                linkText={Messages.fields.secret.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <PasswordInputField name="secret" />

            <Button
              className={settingsStyles.actionButton}
              type="submit"
              disabled={!valid || pristine || loading}
              data-qa="email-settings-submit-button"
            >
              {loading && <Spinner />}
              {Messages.actionButton}
            </Button>
          </form>
        )}
      />
    </>
  );
};
