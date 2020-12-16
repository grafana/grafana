import React, { FC } from 'react';
import { TextInputField, validators } from '@percona/platform-core';
import { Messages } from '../AddNotificationChannelModal.messages';
import { PagerDutyFieldsProps } from './PagerDutyFields.types';

export const PagerDutyFields: FC<PagerDutyFieldsProps> = ({ values }) => {
  const { required } = validators;
  const { routing, service } = values;
  const routingValidators = service ? [] : [required];
  const serviceValidators = routing ? [] : [required];

  return (
    <>
      <TextInputField name="routing" label={Messages.fields.routingKey} validators={routingValidators} />
      <TextInputField name="service" label={Messages.fields.serviceKey} validators={serviceValidators} />
    </>
  );
};
