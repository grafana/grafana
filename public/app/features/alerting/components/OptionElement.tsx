import React, { FC } from 'react';
import { FormAPI, Input, InputControl, Select, Switch, TextArea } from '@grafana/ui';
import { Option } from '../../../types';

interface Props extends Pick<FormAPI<any>, 'register' | 'control'> {
  option: Option;
}

export const OptionElement: FC<Props> = ({ control, option, register }) => {
  const modelValue = `settings.${option.modelValue}`;
  switch (option.element) {
    case 'input':
      return (
        <Input
          type={option.elementType}
          name={`${modelValue}`}
          ref={register({
            required: option.required ? 'Required' : false,
            validate: v => option.validationRule && validateOption(v, option.validationRule),
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
            validate: v => option.validationRule && validateOption(v, option.validationRule),
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
  }
};

const validateOption = (value: string, validationRule: string) => {
  return RegExp(validationRule).test(value) ? true : 'Invalid format';
};
