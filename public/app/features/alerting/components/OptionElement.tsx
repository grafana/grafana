import React, { FC } from 'react';
import { FormAPI, Input, InputControl, Select, Switch, TextArea } from '@grafana/ui';
import { Option } from '../../../types';

interface Props extends Pick<FormAPI<any>, 'register' | 'control'> {
  option: Option;
  name: string;
}

export const OptionElement: FC<Props> = ({ control, option, name, register }) => {
  switch (option.element) {
    case 'input':
      return (
        <Input
          type={option.elementType}
          name={`${name}`}
          ref={register({
            required: option.required ? 'Required' : false,
            validate: v => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
          placeholder={option.placeholder}
        />
      );

    case 'select':
      return <InputControl as={Select} options={option.selectOptions} control={control} name={`${name}`} />;

    case 'textarea':
      return (
        <TextArea
          name={`${name}`}
          ref={register({
            required: option.required ? 'Required' : false,
            validate: v => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
        />
      );

    case 'switch':
      return (
        <Switch
          name={`${name}`}
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
