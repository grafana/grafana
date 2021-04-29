import React, { FC, useEffect } from 'react';
import { Input, InputControl, Select, TextArea } from '@grafana/ui';
import { NotificationChannelOption } from 'app/types';
import { useFormContext } from 'react-hook-form';

interface Props {
  option: NotificationChannelOption;
  invalid?: boolean;
  pathPrefix?: string;
}

export const OptionElement: FC<Props> = ({ option, invalid, pathPrefix = '' }) => {
  const { control, register, unregister } = useFormContext();
  const modelValue = option.secure
    ? `${pathPrefix}secureSettings.${option.propertyName}`
    : `${pathPrefix}settings.${option.propertyName}`;

  // workaround for https://github.com/react-hook-form/react-hook-form/issues/4993#issuecomment-829012506
  useEffect(
    () => () => {
      unregister(modelValue);
    },
    [unregister, modelValue]
  );

  switch (option.element) {
    case 'input':
      return (
        <Input
          invalid={invalid}
          type={option.inputType}
          {...register(`${modelValue}`, {
            required: option.required ? 'Required' : false,
            validate: (v) => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
          placeholder={option.placeholder}
        />
      );

    case 'select':
      return (
        <InputControl
          render={({ field: { onChange, ref, ...field } }) => (
            <Select
              {...field}
              options={option.selectOptions}
              invalid={invalid}
              onChange={(value) => onChange(value.value)}
            />
          )}
          control={control}
          name={`${modelValue}`}
        />
      );

    case 'textarea':
      return (
        <TextArea
          {...register(`${modelValue}`, {
            required: option.required ? 'Required' : false,
            validate: (v) => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
          invalid={invalid}
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
