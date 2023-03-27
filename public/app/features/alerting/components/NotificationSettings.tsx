import React from 'react';

import { Checkbox, CollapsableSection, Field, InfoBox, Input } from '@grafana/ui';

import { NotificationSettingsProps } from './NotificationChannelForm';

interface Props extends NotificationSettingsProps {
  imageRendererAvailable: boolean;
}

export const NotificationSettings = ({ currentFormValues, imageRendererAvailable, register }: Props) => {
  return (
    <CollapsableSection label="Notification settings" isOpen={false}>
      <Field>
        <Checkbox {...register('isDefault')} label="Default" description="Use this notification for all alerts" />
      </Field>
      <Field>
        <Checkbox
          {...register('settings.uploadImage')}
          label="Include image"
          description="Captures an image and include it in the notification"
        />
      </Field>
      {currentFormValues.uploadImage && !imageRendererAvailable && (
        <InfoBox title="No image renderer available/installed">
          Grafana cannot find an image renderer to capture an image for the notification. Please make sure the Grafana
          Image Renderer plugin is installed. Please contact your Grafana administrator to install the plugin.
        </InfoBox>
      )}
      <Field>
        <Checkbox
          {...register('disableResolveMessage')}
          label="Disable Resolve Message"
          description="Disable the resolve message [OK] that is sent when alerting state returns to false"
        />
      </Field>
      <Field>
        <Checkbox
          {...register('sendReminder')}
          label="Send reminders"
          description="Send additional notifications for triggered alerts"
        />
      </Field>
      {currentFormValues.sendReminder && (
        <>
          <Field
            label="Send reminder every"
            description="Specify how often reminders should be sent, e.g. every 30s, 1m, 10m, 30m', or 1h etc.
            Alert reminders are sent after rules are evaluated. A reminder can never be sent more frequently
            than a configured alert rule evaluation interval."
          >
            <Input {...register('frequency')} width={8} />
          </Field>
        </>
      )}
    </CollapsableSection>
  );
};
