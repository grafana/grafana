import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { FC, useEffect } from 'react';
import { Controller, DeepMap, FieldError, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Checkbox,
  Field,
  Input,
  RadioButtonList,
  SecretInput,
  SecretTextArea,
  Select,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { NotificationChannelOption, NotificationChannelSecureFields } from 'app/types';

import { KeyValueMapInput } from './KeyValueMapInput';
import { StringArrayInput } from './StringArrayInput';
import { SubformArrayField } from './SubformArrayField';
import { SubformField } from './SubformField';
import { WrapWithTemplateSelection } from './TemplateSelector';

interface Props {
  defaultValue: any;
  option: NotificationChannelOption;
  // this is defined if the option is rendered inside a subform
  parentOption?: NotificationChannelOption;
  invalid?: boolean;
  pathPrefix: string;
  pathSuffix?: string;
  error?: FieldError | DeepMap<any, FieldError>;
  readOnly?: boolean;
  customValidator?: (value: string) => boolean | string | Promise<boolean | string>;
  onResetSecureField?: (propertyName: string) => void;
  secureFields?: NotificationChannelSecureFields;
}

export const OptionField: FC<Props> = ({
  option,
  parentOption,
  invalid,
  pathPrefix,
  pathSuffix = '',
  error,
  defaultValue,
  readOnly = false,
  customValidator,
  onResetSecureField,
  secureFields = {},
}) => {
  const optionPath = `${pathPrefix}${pathSuffix}`;

  if (option.element === 'subform') {
    return (
      <SubformField
        secureFields={secureFields}
        onResetSecureField={onResetSecureField}
        readOnly={readOnly}
        defaultValue={defaultValue}
        option={option}
        errors={error}
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
        parentOption={parentOption}
        customValidator={customValidator}
        onResetSecureField={onResetSecureField}
        secureFields={secureFields}
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
  onResetSecureField,
  secureFields = {},
  parentOption,
}) => {
  const styles = useStyles2(getStyles);
  const { control, register, unregister, getValues, setValue } = useFormContext();

  const name = `${pathPrefix}${option.propertyName}`;
  const nestedKey = parentOption ? `${parentOption.propertyName}.${option.propertyName}` : option.propertyName;

  const isEncryptedInput = secureFields?.[nestedKey];

  // workaround for https://github.com/react-hook-form/react-hook-form/issues/4993#issuecomment-829012506
  useEffect(
    () => () => {
      unregister(name, { keepValue: false });
    },
    [unregister, name]
  );

  const useTemplates = option.placeholder.includes('{{ template');

  function onSelectTemplate(template: string) {
    setValue(name, template);
  }

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
        <WrapWithTemplateSelection
          useTemplates={useTemplates}
          option={option}
          name={name}
          onSelectTemplate={onSelectTemplate}
        >
          {isEncryptedInput ? (
            <SecretInput onReset={() => onResetSecureField?.(nestedKey)} isConfigured />
          ) : (
            <Input
              id={id}
              readOnly={readOnly || useTemplates || determineReadOnly(option, getValues, pathIndex)}
              invalid={invalid}
              type={option.inputType}
              {...register(name, {
                required: determineRequired(option, getValues, pathIndex),
                validate: {
                  validationRule: (v) =>
                    option.validationRule ? validateOption(v, option.validationRule, option.required) : true,
                  customValidator: (v) => (customValidator ? customValidator(v) : true),
                },
                setValueAs: option.setValueAs,
              })}
              placeholder={option.placeholder}
            />
          )}
        </WrapWithTemplateSelection>
      );

    case 'select':
      return (
        <Controller
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
          defaultValue={option.defaultValue?.value}
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
          <Controller
            render={({ field: { ref, ...field } }) => (
              <RadioButtonList disabled={readOnly} options={option.selectOptions ?? []} {...field} />
            )}
            control={control}
            defaultValue={option.defaultValue?.value}
            name={name}
            rules={{
              required: option.required ? 'Option is required' : false,
              validate: {
                validationRule: (v) =>
                  option.validationRule ? validateOption(v, option.validationRule, option.required) : true,
                customValidator: (v) => (customValidator ? customValidator(v) : true),
              },
            }}
          />
        </>
      );
    case 'textarea':
      return (
        <WrapWithTemplateSelection
          useTemplates={useTemplates}
          option={option}
          name={name}
          onSelectTemplate={onSelectTemplate}
        >
          {isEncryptedInput ? (
            <SecretTextArea onReset={() => onResetSecureField?.(nestedKey)} isConfigured />
          ) : (
            <TextArea
              id={id}
              readOnly={readOnly || useTemplates}
              invalid={invalid}
              placeholder={option.placeholder}
              {...register(name, {
                required: option.required ? 'Required' : false,
                validate: (v) =>
                  option.validationRule !== '' ? validateOption(v, option.validationRule, option.required) : true,
              })}
            />
          )}
        </WrapWithTemplateSelection>
      );
    case 'string_array':
      return (
        <Controller
          render={({ field: { value, onChange } }) => (
            <StringArrayInput readOnly={readOnly} value={value} onChange={onChange} />
          )}
          control={control}
          name={name}
        />
      );
    case 'key_value_map':
      return (
        <Controller
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
  checkbox: css({
    height: 'auto', // native checkbox has fixed height which does not take into account description
  }),
  legend: css({
    fontSize: theme.typography.h6.fontSize,
  }),
});

const validateOption = (value: string, validationRule: string, required: boolean) => {
  if (value === '' && !required) {
    return true;
  }

  return RegExp(validationRule).test(value) ? true : 'Invalid format';
};

const determineRequired = (option: NotificationChannelOption, getValues: any, pathIndex: string) => {
  const secureFields = getValues(`${pathIndex}secureFields`);
  const secureSettings = getValues(`${pathIndex}secureSettings`);

  if (!option.dependsOn) {
    return option.required ? 'Required' : false;
  }
  if (isEmpty(secureFields) || !secureFields[option.dependsOn]) {
    const dependentOn = Boolean(secureSettings[option.dependsOn]);
    return !dependentOn && option.required ? 'Required' : false;
  } else {
    const dependentOn = Boolean(secureFields[option.dependsOn]);
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
