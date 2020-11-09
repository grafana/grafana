import React, { FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { Field, Input, InputControl, Select } from '@grafana/ui';
import { NotificationChannelOptions } from './NotificationChannelOptions';
import { NotificationSettingsProps } from './NotificationChannelForm';
import { NotificationChannelSecureFields, NotificationChannelType } from '../../../types';

interface Props extends NotificationSettingsProps {
  selectedChannel: NotificationChannelType;
  channels: Array<SelectableValue<string>>;
  secureFields: NotificationChannelSecureFields;
  resetSecureField: (key: string) => void;
}

export const BasicSettings: FC<Props> = ({
  control,
  currentFormValues,
  errors,
  secureFields,
  selectedChannel,
  channels,
  register,
  resetSecureField,
}) => {
  return (
    <>
      <Field label="Name" invalid={!!errors.name} error={errors.name && errors.name.message}>
        <Input name="name" ref={register({ required: 'Name is required' })} />
      </Field>
      <Field label="Type">
        <InputControl name="type" as={Select} options={channels} control={control} rules={{ required: true }} />
      </Field>
      <NotificationChannelOptions
        selectedChannelOptions={selectedChannel.options.filter(o => o.required)}
        currentFormValues={currentFormValues}
        secureFields={secureFields}
        onResetSecureField={resetSecureField}
        register={register}
        errors={errors}
        control={control}
      />
    </>
  );
};
