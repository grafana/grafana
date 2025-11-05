import { css } from '@emotion/css';
import { FC } from 'react';
import { Controller, DeepMap, FieldError, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Checkbox,
  Field,
  Icon,
  Input,
  RadioButtonList,
  SecretInput,
  SecretTextArea,
  Select,
  Stack,
  TextArea,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { NotificationChannelOption, NotificationChannelSecureFields ,OptionMeta} from 'app/types';

import { KeyValueMapInput } from './KeyValueMapInput';
import { StringArrayInput } from './StringArrayInput';
import { SubformArrayField } from './SubformArrayField';
import { SubformField } from './SubformField';
import { WrapWithTemplateSelection } from './TemplateSelector';

interface Props {
  defaultValue: any;
  option: NotificationChannelOption;
  getOptionMeta?: (option: NotificationChannelOption) => OptionMeta;
  invalid?: boolean;
  pathPrefix: string;
  error?: FieldError | DeepMap<any, FieldError>;
  readOnly?: boolean;
  customValidator?: (value: string) => boolean | string | Promise<boolean | string>;
  onResetSecureField?: (propertyName: string) => void;
  onDeleteSubform?: (settingsPath: string, option: NotificationChannelOption) => void;
  secureFields: NotificationChannelSecureFields;
}

export const OptionField: FC<Props> = ({
  option,
  invalid,
  pathPrefix,
  error,
  defaultValue,
  readOnly = false,
  customValidator,
  onResetSecureField,
  secureFields,
  onDeleteSubform,
  getOptionMeta,
}) => {
  if (option.element === 'subform') {
    return (
      <SubformField
        secureFields={secureFields}
        onResetSecureField={onResetSecureField}
        readOnly={readOnly}
        defaultValue={defaultValue}
        option={option}
        errors={error}
        pathPrefix={pathPrefix}
        onDelete={onDeleteSubform}
        getOptionMeta={getOptionMeta}
      />
    );
  }
  if (option.element === 'subform_array') {
    return (
      <SubformArrayField
        secureFields={secureFields}
        readOnly={readOnly}
        defaultValues={defaultValue}
        option={option}
        pathPrefix={pathPrefix}
        errors={error as Array<DeepMap<any, FieldError>> | undefined}
        getOptionMeta={getOptionMeta}
      />
    );
  }

  const shouldShowProtectedIndicator = option.protected && getOptionMeta?.(option).readOnly;

  const labelText = option.element !== 'checkbox' && option.element !== 'radio' ? option.label : undefined;

  const label = shouldShowProtectedIndicator ? (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Tooltip
        content={t(
          'alerting.receivers.protected.field.description',
          'This field is protected and can only be edited by users with elevated permissions'
        )}
      >
        <Icon size="sm" name="lock" data-testid="lock-icon" />
      </Tooltip>
      {labelText}
    </Stack>
  ) : labelText;

  return (
    <Field
      label={label}
      description={option.description || undefined}
      invalid={!!error}
      error={error?.message}
      data-testid={`${pathPrefix}${option.propertyName}`}
    >
      <OptionInput
        id={`${pathPrefix}${option.propertyName}`}
        defaultValue={defaultValue}
        option={option}
        invalid={invalid}
        pathPrefix={pathPrefix}
        readOnly={readOnly}
        customValidator={customValidator}
        onResetSecureField={onResetSecureField}
        secureFields={secureFields}
        getOptionMeta={getOptionMeta}
      />
    </Field>
  );
};

const OptionInput: FC<Props & { id: string }> = ({
  option,
  invalid,
  id,
  pathPrefix = '',
  readOnly = false,
  customValidator,
  onResetSecureField,
  secureFields = {},
  getOptionMeta,
}) => {
  const styles = useStyles2(getStyles);
  const { control, register, setValue } = useFormContext();

  const optionMeta = getOptionMeta?.(option);

  const name = `${pathPrefix}${option.propertyName}`;

  // For nested secure fields, construct the full path relative to settings
  // e.g., if pathPrefix is "items.0.settings.sigv4." and propertyName is "access_key"
  // we need to look for "sigv4.access_key" in secureFields
  const getSecureFieldLookupKey = (): string => {
    if (!option.secure) {
      return '';
    }

    // Use secureFieldKey if explicitly set (from mockGrafanaNotifiers)
    if (option.secureFieldKey) {
      return option.secureFieldKey;
    }

    // Extract the path after "settings." to build the lookup key for nested fields
    const settingsMatch = pathPrefix.match(/settings\.(.+)$/);
    if (settingsMatch) {
      const nestedPath = settingsMatch[1];
      return `${nestedPath}${option.propertyName}`;
    }

    // Default to just the property name for non-nested fields
    return option.propertyName;
  };

  const secureFieldKey = getSecureFieldLookupKey();
  const isEncryptedInput = secureFieldKey && secureFields?.[secureFieldKey];

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
            <SecretInput id={id} onReset={() => onResetSecureField?.(secureFieldKey)} isConfigured />
          ) : (
            <Input
              id={id}
              readOnly={readOnly || useTemplates || optionMeta?.readOnly}
              invalid={invalid}
              type={option.inputType}
              {...register(name, {
                required: optionMeta?.required,
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
            <SecretTextArea id={id} onReset={() => onResetSecureField?.(secureFieldKey)} isConfigured />
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
