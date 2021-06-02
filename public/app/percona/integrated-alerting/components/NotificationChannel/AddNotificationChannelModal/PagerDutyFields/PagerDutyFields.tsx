import React, { FC } from 'react';
import { RadioButtonGroupField, TextInputField, validators } from '@percona/platform-core';
import { Messages } from '../AddNotificationChannelModal.messages';
import { PagerDutyFieldsProps } from './PagerDutyFields.types';
import { PagerDutyKeyType } from '../../NotificationChannel.types';
import { PAGER_DUTY_TYPE_OPTIONS } from '../AddNotificationChannel.constants';

const { required } = validators;
const keyValidator = [required];

export const PagerDutyFields: FC<PagerDutyFieldsProps> = ({ values }) => {
  let label = Messages.fields.routingKey;
  let name = PagerDutyKeyType.routing;

  if (values.keyType === PagerDutyKeyType.service) {
    label = Messages.fields.serviceKey;
    name = PagerDutyKeyType.service;
  }

  return (
    <>
      <RadioButtonGroupField
        name="keyType"
        options={PAGER_DUTY_TYPE_OPTIONS}
        initialValue={values?.keyType || PAGER_DUTY_TYPE_OPTIONS[0].value}
        fullWidth
      />
      <TextInputField name={name} label={label} validators={keyValidator} />
    </>
  );
};
