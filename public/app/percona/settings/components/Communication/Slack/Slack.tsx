import { Form } from 'react-final-form';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import React, { FC, useState } from 'react';
import { TextInputField } from '@percona/platform-core';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { getSettingsStyles } from '../../../Settings.styles';
import { LoadingCallback } from '../../../Settings.service';
import { Messages } from '../Communication.messages';
import { SlackPayload, SlackSettings } from '../../../Settings.types';

export interface SlackProps {
  settings: SlackSettings;
  updateSettings: (body: SlackPayload, callback: LoadingCallback) => void;
}

export const Slack: FC<SlackProps> = ({ updateSettings, settings }) => {
  const settingsStyles = useStyles2(getSettingsStyles);
  const [loading, setLoading] = useState(false);

  const applyChanges = (values: SlackSettings) => {
    updateSettings(
      {
        slack_alerting_settings: values,
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
          <form onSubmit={handleSubmit} data-testid="slack-form">
            <div className={settingsStyles.labelWrapper}>
              <span>{Messages.fields.slackURL.label}</span>
              <LinkTooltip
                tooltipText={Messages.fields.slackURL.tooltipText}
                link={Messages.fields.slackURL.tooltipLink}
                linkText={Messages.fields.slackURL.tooltipLinkText}
                icon="info-circle"
              />
            </div>
            <TextInputField name="url" />

            <Button
              className={settingsStyles.actionButton}
              type="submit"
              disabled={!valid || pristine || loading}
              data-testid="slack-settings--submit-button"
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
