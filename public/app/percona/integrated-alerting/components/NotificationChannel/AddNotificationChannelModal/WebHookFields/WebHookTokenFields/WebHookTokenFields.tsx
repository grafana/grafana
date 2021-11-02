import React, { FC } from 'react';
import { TextareaInputField } from '@percona/platform-core';
import { Messages } from '../../AddNotificationChannelModal.messages';

export const WebHookTokenFields: FC = () => <TextareaInputField name="token" label={Messages.fields.token} />;
