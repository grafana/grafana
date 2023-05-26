import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Field, Input, InputControl, Select } from '@grafana/ui';

import { NotificationChannelSecureFields, NotificationChannelType } from '../../../types';

import { NotificationSettingsProps } from './NotificationChannelForm';
import { NotificationChannelOptions } from './NotificationChannelOptions';

interface Props extends NotificationSettingsProps {
  selectedChannel: NotificationChannelType;
  channels: Array<SelectableValue<string>>;
  secureFields: NotificationChannelSecureFields;
  resetSecureField: (key: string) => void;
}

export const BasicSettings = ({
  control,
  currentFormValues,
  errors,
  secureFields,
  selectedChannel,
  channels,
  register,
  resetSecureField,
}: Props) => {
  return (
    <>
      <Field label="Name" invalid={!!errors.name} error={errors.name && errors.name.message}>
        <Input {...register('name', { required: 'Name is required' })} />
      </Field>
      <Field label="Type">
        <InputControl
          name="type"
          render={({ field: { ref, ...field } }) => <Select {...field} options={channels} />}
          control={control}
          rules={{ required: true }}
        />
      </Field>
      <NotificationChannelOptions
        selectedChannelOptions={selectedChannel.options.filter((o) => o.required)}
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
