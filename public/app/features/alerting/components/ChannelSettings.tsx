import React, { FC } from 'react';
import { Alert, CollapsableSection } from '@grafana/ui';
import { NotificationChannelOptions } from './NotificationChannelOptions';
import { NotificationSettingsProps } from './NotificationChannelForm';
import { NotificationChannelSecureFields, NotificationChannelType } from '../../../types';

interface Props extends NotificationSettingsProps {
  selectedChannel: NotificationChannelType;
  secureFields: NotificationChannelSecureFields;
  resetSecureField: (key: string) => void;
}

export const ChannelSettings: FC<Props> = ({
  control,
  currentFormValues,
  errors,
  selectedChannel,
  secureFields,
  register,
  resetSecureField,
}) => {
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
