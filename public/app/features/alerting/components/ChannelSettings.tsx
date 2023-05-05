import React from 'react';

import { Alert, CollapsableSection } from '@grafana/ui';

import { NotificationChannelSecureFields, NotificationChannelType } from '../../../types';

import { NotificationSettingsProps } from './NotificationChannelForm';
import { NotificationChannelOptions } from './NotificationChannelOptions';

interface Props extends NotificationSettingsProps {
  selectedChannel: NotificationChannelType;
  secureFields: NotificationChannelSecureFields;
  resetSecureField: (key: string) => void;
}

export const ChannelSettings = ({
  control,
  currentFormValues,
  errors,
  selectedChannel,
  secureFields,
  register,
  resetSecureField,
}: Props) => {
  return (
    <CollapsableSection label={`Optional ${selectedChannel.heading}`} isOpen={false}>
      {selectedChannel.info !== '' && <Alert severity="info" title={selectedChannel.info ?? ''} />}
      <NotificationChannelOptions
        selectedChannelOptions={selectedChannel.options.filter((o) => !o.required)}
        currentFormValues={currentFormValues}
        register={register}
        errors={errors}
        control={control}
        onResetSecureField={resetSecureField}
        secureFields={secureFields}
      />
    </CollapsableSection>
  );
};
