import React, { FC } from 'react';
import { TextareaInputField, validators } from '@percona/platform-core';
import { useStyles } from '@grafana/ui';
import { Messages } from '../AddNotificationChannelModal.messages';
import { getStyles } from './EmailFields.styles';

export const EmailFields: FC = () => {
  const styles = useStyles(getStyles);
  const { required } = validators;

  return (
    <TextareaInputField
      name="emails"
      className={styles.addresses}
      label={Messages.fields.addresses}
      placeholder={Messages.fields.addressesPlaceholder}
      validators={[required]}
    />
  );
};
