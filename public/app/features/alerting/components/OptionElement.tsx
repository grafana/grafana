import React, { FC } from 'react';

import { FormAPI, Input, InputControl, Select, TextArea } from '@grafana/ui';

import { NotificationChannelOption } from '../../../types';

interface Props extends Pick<FormAPI<any>, 'register' | 'control'> {
  option: NotificationChannelOption;
  invalid?: boolean;
}

export const OptionElement: FC<Props> = ({ control, option, register, invalid }) => {
  const modelValue = option.secure ? `secureSettings.${option.propertyName}` : `settings.${option.propertyName}`;
  switch (option.element) {
    case 'input':
      return (
        <Input
          {...register(`${modelValue}`, {
            required: option.required ? 'Required' : false,
            validate: (v) => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
          invalid={invalid}
          type={option.inputType}
          placeholder={option.placeholder}
        />
      );

    case 'select':
      return (
        <InputControl
          control={control}
          name={`${modelValue}`}
          render={({ field: { ref, ...field } }) => (
            <Select {...field} options={option.selectOptions ?? undefined} invalid={invalid} />
          )}
        />
      );

    case 'textarea':
      return (
        <TextArea
          invalid={invalid}
          {...register(`${modelValue}`, {
            required: option.required ? 'Required' : false,
            validate: (v) => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
        />
      );

    default:
      console.error('Element not supported', option.element);
      return null;
  }
};

const validateOption = (value: string, validationRule: string) => {
  return RegExp(validationRule).test(value) ? true : 'Invalid format';
};
