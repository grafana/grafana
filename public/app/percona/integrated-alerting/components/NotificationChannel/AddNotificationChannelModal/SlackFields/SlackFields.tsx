import React, { FC } from 'react';
import { TextInputField, validators } from '@percona/platform-core';
import { Messages } from '../AddNotificationChannelModal.messages';

const channelNameValidator = (value: string) =>
  value && value.includes('#') ? Messages.invalidChannelName : undefined;

export const SlackFields: FC = () => {
  const { required } = validators;

  return (
    <TextInputField name="channel" label={Messages.fields.channel} validators={[required, channelNameValidator]} />
  );
};
