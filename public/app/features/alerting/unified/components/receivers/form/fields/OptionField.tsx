import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import React, { FC, useEffect } from 'react';
import { useFormContext, FieldError, DeepMap } from 'react-hook-form';

import { Checkbox, Field, Input, InputControl, Select, TextArea } from '@grafana/ui';
import { NotificationChannelOption } from 'app/types';

import { KeyValueMapInput } from './KeyValueMapInput';
import { StringArrayInput } from './StringArrayInput';
import { SubformArrayField } from './SubformArrayField';
import { SubformField } from './SubformField';

interface Props {
  defaultValue: any;
  option: NotificationChannelOption;
  invalid?: boolean;
  pathPrefix: string;
  pathSuffix?: string;
  error?: FieldError | DeepMap<any, FieldError>;
  readOnly?: boolean;
}

export const OptionField: FC<Props> = ({
  option,
  invalid,
  pathPrefix,
  pathSuffix = '',
  error,
  defaultValue,
  readOnly = false,
}) => {
  const optionPath = `${pathPrefix}${pathSuffix}`;

  if (option.element === 'subform') {
    return (
      <SubformField
        readOnly={readOnly}
        defaultValue={defaultValue}
        option={option}
        errors={error as DeepMap<any, FieldError> | undefined}
        pathPrefix={optionPath}
      />
    );
  }
  if (option.element === 'subform_array') {
    return (
      <SubformArrayField
        readOnly={readOnly}
        defaultValues={defaultValue}
        option={option}
        pathPrefix={optionPath}
        errors={error as Array<DeepMap<any, FieldError>> | undefined}
      />
    );
  }
  return (
    <Field
      label={option.element !== 'checkbox' ? option.label : undefined}
      description={option.description || undefined}
      invalid={!!error}
      error={error?.message}
    >
      <OptionInput
        id={`${optionPath}${option.propertyName}`}
        defaultValue={defaultValue}
        option={option}
        invalid={invalid}
        pathPrefix={optionPath}
        readOnly={readOnly}
        pathIndex={pathPrefix}
      />
    </Field>
  );
};

const OptionInput: FC<Props & { id: string; pathIndex?: string }> = ({
  option,
  invalid,
  id,
  pathPrefix = '',
  pathIndex = '',
  readOnly = false,
}) => {
  const { control, register, unregister, getValues } = useFormContext();
  const name = `${pathPrefix}${option.propertyName}`;

  // workaround for https://github.com/react-hook-form/react-hook-form/issues/4993#issuecomment-829012506
  useEffect(
    () => () => {
      unregister(name, { keepValue: false });
    },
    [unregister, name]
  );
  switch (option.element) {
    case 'checkbox':
      return (
        <Checkbox
          id={id}
          readOnly={readOnly}
          disabled={readOnly}
          className={styles.checkbox}
          {...register(name)}
          label={option.label}
          description={option.description}
        />
      );
    case 'input':
      return (
        <Input
          id={id}
          readOnly={readOnly || determineReadOnly(option, getValues, pathIndex)}
          invalid={invalid}
          type={option.inputType}
          {...register(name, {
            required: determineRequired(option, getValues, pathIndex),
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
              disabled={readOnly}
              {...field}
              options={option.selectOptions ?? undefined}
              invalid={invalid}
              onChange={(value) => onChange(value.value)}
            />
          )}
          control={control}
          name={name}
        />
      );

    case 'textarea':
      return (
        <TextArea
          id={id}
          readOnly={readOnly}
          invalid={invalid}
          {...register(name, {
            required: option.required ? 'Required' : false,
            validate: (v) => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
          })}
        />
      );
    case 'string_array':
      return (
        <InputControl
          render={({ field: { value, onChange } }) => (
            <StringArrayInput readOnly={readOnly} value={value} onChange={onChange} />
          )}
          control={control}
          name={name}
        />
      );
    case 'key_value_map':
      return (
        <InputControl
          render={({ field: { value, onChange } }) => (
            <KeyValueMapInput readOnly={readOnly} value={value} onChange={onChange} />
          )}
          control={control}
          name={name}
        />
      );

    default:
      console.error('Element not supported', option.element);
      return null;
  }
};

const styles = {
  checkbox: css`
    height: auto; // native checkbox has fixed height which does not take into account description
  `,
};

const validateOption = (value: string, validationRule: string) => {
  return RegExp(validationRule).test(value) ? true : 'Invalid format';
};

const determineRequired = (option: NotificationChannelOption, getValues: any, pathIndex: string) => {
  if (!option.dependsOn) {
    return option.required ? 'Required' : false;
  }
  if (isEmpty(getValues(`${pathIndex}secureFields`))) {
    const dependentOn = getValues(`${pathIndex}secureSettings.${option.dependsOn}`);
    return !Boolean(dependentOn) && option.required ? 'Required' : false;
  } else {
    const dependentOn: boolean = getValues(`${pathIndex}secureFields.${option.dependsOn}`);
    return !dependentOn && option.required ? 'Required' : false;
  }
};

const determineReadOnly = (option: NotificationChannelOption, getValues: any, pathIndex: string) => {
  if (!option.dependsOn) {
    return false;
  }
  if (isEmpty(getValues(`${pathIndex}secureFields`))) {
    return getValues(`${pathIndex}secureSettings.${option.dependsOn}`);
  } else {
    return getValues(`${pathIndex}secureFields.${option.dependsOn}`);
  }
};
