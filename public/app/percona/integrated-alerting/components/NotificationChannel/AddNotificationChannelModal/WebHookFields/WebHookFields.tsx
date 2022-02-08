import React, { FC, useState } from 'react';
import {
  CheckboxField,
  NumberInputField,
  RadioButtonGroupField,
  TextareaInputField,
  TextInputField,
  validators,
} from '@percona/platform-core';
import { Collapse } from '@grafana/ui';
import { validators as customValidators } from 'app/percona/shared/helpers/validators';
import { WebHookAuthType } from '../../NotificationChannel.types';
import { WEBHOOK_TYPE_OPTIONS } from '../AddNotificationChannel.constants';
import { Messages } from '../AddNotificationChannelModal.messages';
import { WebHookBasicFields } from './WebHookBasicFields/WebHookBasicFields';
import { WebHookFieldsProps } from './WebHookFields.types';
import { WebHookTokenFields } from './WebHookTokenFields/WebHookTokenFields';

export const WebHookFields: FC<WebHookFieldsProps> = ({ values }) => {
  const [showTlsFields, setShowTlsFields] = useState(false);
  return (
    <>
      <TextInputField
        name="url"
        label={Messages.fields.url}
        validators={[validators.required, customValidators.validateUrl]}
      />
      <RadioButtonGroupField
        fullWidth
        name="webHookType"
        options={WEBHOOK_TYPE_OPTIONS}
        initialValue={values.webHookType || WEBHOOK_TYPE_OPTIONS[0].value}
        label={Messages.fields.authType}
      />
      {values.webHookType === WebHookAuthType.basic && <WebHookBasicFields />}
      {values.webHookType === WebHookAuthType.token && <WebHookTokenFields />}
      <CheckboxField name="sendResolved" label={Messages.fields.sendResolved} />
      <NumberInputField
        name="maxAlerts"
        defaultValue={0}
        label={Messages.fields.maxAlerts}
        validators={[customValidators.min(0)]}
      />
      <Collapse
        collapsible
        label={Messages.fields.tlsSettings}
        isOpen={showTlsFields}
        onToggle={() => setShowTlsFields((open) => !open)}
      >
        <TextareaInputField name="ca" label={Messages.fields.ca} />
        <TextareaInputField name="cert" label={Messages.fields.certificate} />
        <TextareaInputField name="key" label={Messages.fields.certKey} />
        <TextInputField name="serverName" label={Messages.fields.serverName} />
        <CheckboxField name="skipVerify" label={Messages.fields.skipVerify} />
      </Collapse>
    </>
  );
};
