import { TextareaInputField } from '@percona/platform-core';
import React, { FC } from 'react';

import { Messages } from '../../AddNotificationChannelModal.messages';

export const WebHookTokenFields: FC = () => <TextareaInputField name="token" label={Messages.fields.token} />;
