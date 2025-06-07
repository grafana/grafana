import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { UseFormReturn, Controller } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Checkbox, Field, Input, SecretInput, Select, Switch, useTheme2 } from '@grafana/ui';

import { fieldMap } from './fields';
import { SSOProviderDTO, SSOSettingsField } from './types';
import { isSelectableValueArray } from './utils/guards';

interface FieldRendererProps
  extends Pick<
    UseFormReturn<SSOProviderDTO>,
    'register' | 'control' | 'watch' | 'setValue' | 'getValues' | 'unregister'
  > {
  field: SSOSettingsField;
  errors: UseFormReturn['formState']['errors'];
  secretConfigured: boolean;
  provider: string;
}

export const FieldRenderer = ({
  field,
  register,
  errors,
  watch,
  setValue,
  getValues,
  control,
  unregister,
  secretConfigured,
  provider,
}: FieldRendererProps) => {
  const [isSecretConfigured, setIsSecretConfigured] = useState(secretConfigured);
  const isDependantField = typeof field !== 'string';
  const name = isDependantField ? field.name : field;
  const parentValue = isDependantField ? watch(field.dependsOn) : null;
  const fieldData = fieldMap(provider)[name];
  const theme = useTheme2();
  // Unregister a field that depends on a toggle to clear its data
  useEffect(() => {
    if (isDependantField) {
      if (!parentValue) {
        unregister(name);
      }
    }
  }, [unregister, name, parentValue, isDependantField]);

  const isNotEmptySelectableValueArray = (
    current: string | boolean | Record<string, string> | Array<SelectableValue<string>> | undefined
  ): current is Array<SelectableValue<string>> => {
    return Array.isArray(current) && current.length > 0 && 'value' in current[0];
  };

  useEffect(() => {
    if (fieldData.defaultValue) {
      const current = getValues(name);
      const obj = fieldData.options?.find(
        (option) => option.value === (isNotEmptySelectableValueArray(current) ? current[0].value : undefined)
      );
      setValue(name, obj?.value || fieldData.defaultValue.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!field) {
    console.log('missing field:', name);
    return null;
  }

  if (!!fieldData.hidden) {
    return null;
  }

  // Dependant field means the field depends on another field's value and shouldn't be rendered if the parent field is false
  if (isDependantField) {
    const parentValue = watch(field.dependsOn);
    if (!parentValue) {
      return null;
    }
  }
  const fieldProps = {
    label: fieldData.label,
    required: !!fieldData.validation?.required,
    invalid: !!errors[name],
    error: fieldData.validation?.message,
    description: fieldData.description,
    defaultValue: fieldData.defaultValue?.value,
  };

  switch (fieldData.type) {
    case 'text':
      return (
        <Field key={name} {...fieldProps}>
          <Input {...register(name, fieldData.validation)} type={fieldData.type} id={name} autoComplete={'off'} />
        </Field>
      );
    case 'secret':
      return (
        <Field key={name} {...fieldProps} htmlFor={name}>
          <Controller
            name={name}
            control={control}
            rules={fieldData.validation}
            render={({ field: { ref, value, ...field } }) => (
              <SecretInput
                {...field}
                autoComplete={'off'}
                id={name}
                value={typeof value === 'string' ? value : ''}
                isConfigured={isSecretConfigured}
                onReset={() => {
                  setIsSecretConfigured(false);
                  setValue(name, '');
                }}
              />
            )}
          />
        </Field>
      );
    case 'select':
      const watchOptions = watch(name);
      let options = fieldData.options;
      if (!fieldData.options?.length) {
        options = isSelectableValueArray(watchOptions) ? watchOptions : [];
      }
      return (
        <Field key={name} {...fieldProps} htmlFor={name}>
          <Controller
            rules={fieldData.validation}
            name={name}
            control={control}
            render={({ field: { ref, onChange, ...fieldProps }, fieldState: { invalid } }) => {
              return (
                <Select
                  {...fieldProps}
                  placeholder={fieldData.placeholder}
                  isMulti={fieldData.multi}
                  invalid={invalid}
                  inputId={name}
                  options={options}
                  allowCustomValue={!!fieldData.allowCustomValue}
                  defaultValue={fieldData.defaultValue}
                  onChange={onChange}
                  onCreateOption={(v) => {
                    const customValue = { value: v, label: v };
                    onChange([...(options || []), customValue]);
                  }}
                />
              );
            }}
          />
        </Field>
      );
    case 'switch':
      return (
        <Field key={name} {...fieldProps}>
          <Switch {...register(name)} id={name} />
        </Field>
      );
    case 'checkbox':
      return (
        <Checkbox
          key={name}
          {...register(name)}
          id={name}
          {...fieldProps}
          className={css({ marginBottom: theme.spacing(2) })}
        />
      );
    case 'custom':
      return (
        <Field key={name} {...fieldProps}>
          {fieldData.content ? fieldData.content(setValue) : <></>}
        </Field>
      );
    default:
      console.error(`Unknown field type: ${fieldData.type}`);
      return null;
  }
};
