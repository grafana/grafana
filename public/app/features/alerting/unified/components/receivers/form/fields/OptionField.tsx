import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import React, { FC, useEffect } from 'react';
import { useFormContext, FieldError, DeepMap } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Field, Input, InputControl, RadioButtonList, Select, TextArea, useStyles2 } from '@grafana/ui';
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
  customValidator?: (value: string) => boolean | string | Promise<boolean | string>;
}

export const OptionField: FC<Props> = ({
  option,
  invalid,
  pathPrefix,
  pathSuffix = '',
  error,
  defaultValue,
  readOnly = false,
  customValidator,
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
      label={option.element !== 'checkbox' && option.element !== 'radio' ? option.label : undefined}
      description={option.description || undefined}
      invalid={!!error}
      error={error?.message}
      data-testid={`${optionPath}${option.propertyName}`}
    >
      <OptionInput
        id={`${optionPath}${option.propertyName}`}
        defaultValue={defaultValue}
        option={option}
        invalid={invalid}
        pathPrefix={optionPath}
        readOnly={readOnly}
        pathIndex={pathPrefix}
        customValidator={customValidator}
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
  customValidator,
}) => {
  const styles = useStyles2(getStyles);
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
            validate: {
              validationRule: (v) => (option.validationRule ? validateOption(v, option.validationRule) : true),
              customValidator: (v) => (customValidator ? customValidator(v) : true),
            },
            setValueAs: option.setValueAs,
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
              options={option.selectOptions ?? undefined}
              invalid={invalid}
              onChange={(value) => onChange(value.value)}
              {...field}
            />
          )}
          control={control}
          name={name}
          defaultValue={option.defaultValue}
          rules={{
            validate: {
              customValidator: (v) => (customValidator ? customValidator(v) : true),
            },
          }}
        />
      );
    case 'radio':
      return (
        <>
          <legend className={styles.legend}>{option.label}</legend>
          <InputControl
            render={({ field: { ref, ...field } }) => (
              <RadioButtonList disabled={readOnly} options={option.selectOptions ?? []} {...field} />
            )}
            control={control}
            defaultValue={option.defaultValue?.value}
            name={name}
            rules={{
              required: option.required ? 'Option is required' : false,
              validate: {
                validationRule: (v) => (option.validationRule ? validateOption(v, option.validationRule) : true),
                customValidator: (v) => (customValidator ? customValidator(v) : true),
              },
            }}
          />
        </>
      );
    case 'textarea':
      return (
        <TextArea
          id={id}
          readOnly={readOnly}
          invalid={invalid}
          placeholder={option.placeholder}
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

const getStyles = (theme: GrafanaTheme2) => ({
  checkbox: css`
    height: auto; // native checkbox has fixed height which does not take into account description
  `,
  legend: css`
    font-size: ${theme.typography.h6.fontSize};
  `,
});

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
