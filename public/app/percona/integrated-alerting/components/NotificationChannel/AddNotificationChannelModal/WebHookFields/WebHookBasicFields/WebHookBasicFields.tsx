import React, { FC } from 'react';
import { TextInputField } from '@percona/platform-core';
import { SecretToggler } from 'app/percona/shared/components/Elements/SecretToggler';
import { Messages } from '../../AddNotificationChannelModal.messages';

export const WebHookBasicFields: FC = () => (
  <>
    <TextInputField name="username" label={Messages.fields.username} />
    <SecretToggler readOnly={false} fieldProps={{ name: 'password', label: Messages.fields.password }} />
  </>
);
