import React, { FC, useEffect } from 'react';
import { Checkbox, Field, Input, InputControl, Select, TextArea } from '@grafana/ui';
import { NotificationChannelOption } from 'app/types';
import { useFormContext, FieldError, NestDataObject } from 'react-hook-form';
import { SubformField } from './SubformField';
import { css } from '@emotion/css';
import { KeyValueField } from './KeyValueMapField';

interface Props {
  option: NotificationChannelOption;
  invalid?: boolean;
  pathPrefix: string;
  error?: FieldError | NestDataObject<any, FieldError>;
}

export const OptionField: FC<Props> = ({ option, invalid, pathPrefix, error }) => {
  if (option.element === 'subform') {
    return <SubformField option={option} error={error} pathPrefix={pathPrefix} />;
  }
  if (option.element === 'key_value_map') {
    return <KeyValueField option={option} path={`${pathPrefix}${option.propertyName}`} />;
  }

  return (
    <Field
      label={option.element !== 'checkbox' ? option.label : undefined}
      description={option.description || undefined}
      invalid={!!error}
      error={error?.message}
    >
      <OptionInput option={option} invalid={invalid} pathPrefix={pathPrefix} />
    </Field>
  );
};

const OptionInput: FC<Props> = ({ option, invalid, pathPrefix = '' }) => {
  const { control, register, unregister } = useFormContext();
  const name = `${pathPrefix}${option.propertyName}`;

  // workaround for https://github.com/react-hook-form/react-hook-form/issues/4993#issuecomment-829012506
  useEffect(
    () => () => {
      unregister(name);
    },
    [unregister, name]
  );
  switch (option.element) {
    case 'checkbox':
      return (
        <Checkbox
          className={styles.checkbox}
          name={name}
          ref={register()}
          label={option.label}
          description={option.description}
        />
      );
    case 'input':
      return (
        <Input
          invalid={invalid}
          type={option.inputType}
          {...register(name, {
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
          name={name}
          invalid={invalid}
          onChange={(values) => values[0].value}
        />
      );

    case 'textarea':
      return (
        <TextArea
          invalid={invalid}
          name={name}
          ref={register({
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

const styles = {
  checkbox: css`
    height: auto; // native chekbox has fixed height which does not take into account description
  `,
};

const validateOption = (value: string, validationRule: string) => {
  return RegExp(validationRule).test(value) ? true : 'Invalid format';
};
