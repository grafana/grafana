import React, { FC } from 'react';
import { FormAPI, Input, InputControl, Select, Switch, TextArea } from '@grafana/ui';
import { Option } from '../../../types';

interface Props extends Pick<FormAPI<any>, 'register' | 'control'> {
  option: Option;
}

export const OptionElement: FC<Props> = ({ control, option, register }) => {
  const modelValue = `settings.${option.propertyName}`;
  switch (option.element) {
    case 'input':
      return (
        <Input
          type={option.inputType}
          name={`${modelValue}`}
          ref={register({
            required: option.required ? 'Required' : false,
            validate: v => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
          placeholder={option.placeholder}
        />
      );

    case 'select':
      return <InputControl as={Select} options={option.selectOptions} control={control} name={`${modelValue}`} />;

    case 'textarea':
      return (
        <TextArea
          name={`${modelValue}`}
          ref={register({
            required: option.required ? 'Required' : false,
            validate: v => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
        />
      );

    case 'switch':
      return (
        <Switch
          name={`${modelValue}`}
          ref={register({
            required: option.required ? 'Required' : false,
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
