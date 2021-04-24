import React, { FC } from 'react';
import { Input, InputControl, Select, TextArea } from '@grafana/ui';
import { NotificationChannelOption } from 'app/types';
import { useFormContext } from 'react-hook-form';

interface Props {
  option: NotificationChannelOption;
  invalid?: boolean;
  pathPrefix?: string;
}

export const OptionElement: FC<Props> = ({ option, invalid, pathPrefix = '' }) => {
  const { control, register } = useFormContext();
  const modelValue = option.secure
    ? `${pathPrefix}secureSettings.${option.propertyName}`
    : `${pathPrefix}settings.${option.propertyName}`;
  switch (option.element) {
    case 'input':
      return (
        <Input
          invalid={invalid}
          type={option.inputType}
          name={`${modelValue}`}
          ref={register({
            required: option.required ? 'Required' : false,
            validate: (v) => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
          placeholder={option.placeholder}
        />
      );

    case 'select':
      return (
        <InputControl
          as={Select}
          options={option.selectOptions}
          control={control}
          name={`${modelValue}`}
          invalid={invalid}
          onChange={(values) => values[0].value}
        />
      );

    case 'textarea':
      return (
        <TextArea
          invalid={invalid}
          name={`${modelValue}`}
          ref={register({
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
