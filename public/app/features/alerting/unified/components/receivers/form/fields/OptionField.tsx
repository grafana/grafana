import { css } from '@emotion/css';
import { type FC } from 'react';
import { Controller, type DeepMap, type FieldError, type FieldValues, useFormContext } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
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
import {
  type NotificationChannelOption,
  type NotificationChannelSecureFields,
  type OptionMeta,
} from 'app/features/alerting/unified/types/alerting';

import { KeyValueMapInput } from './KeyValueMapInput';
import { KeyValueObjectMapInput } from './KeyValueObjectMapInput';
import { StringArrayInput } from './StringArrayInput';
import { SubformArrayField } from './SubformArrayField';
import { SubformField } from './SubformField';
import { WrapWithTemplateSelection } from './TemplateSelector';

interface Props {
  defaultValue: unknown;
  option: NotificationChannelOption;
  getOptionMeta?: (option: NotificationChannelOption) => OptionMeta;
  invalid?: boolean;
  pathPrefix: string;
  secureFieldPathPrefix?: string;
  error?: FieldError | DeepMap<FieldValues, FieldError> | Array<DeepMap<FieldValues, FieldError>>;
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
  secureFieldPathPrefix = '',
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
        secureFieldPathPrefix={secureFieldPathPrefix}
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
        defaultValues={Array.isArray(defaultValue) ? defaultValue : undefined}
        option={option}
        pathPrefix={pathPrefix}
        secureFieldPathPrefix={secureFieldPathPrefix}
        errors={isErrorArray(error) ? error : undefined}
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
  ) : (
    labelText
  );

  return (
    <Field
      label={label}
      description={option.description || undefined}
      invalid={!!error}
      error={getErrorMessage(error)}
      data-testid={selectors.pages.Alerting.ContactPointForm.settingsField(`${pathPrefix}${option.propertyName}`)}
    >
      <OptionInput
        id={`${pathPrefix}${option.propertyName}`}
        defaultValue={defaultValue}
        error={error}
        option={option}
        invalid={invalid}
        pathPrefix={pathPrefix}
        secureFieldPathPrefix={secureFieldPathPrefix}
        readOnly={readOnly}
        customValidator={customValidator}
        onResetSecureField={onResetSecureField}
        onDeleteSubform={onDeleteSubform}
        secureFields={secureFields}
        getOptionMeta={getOptionMeta}
      />
    </Field>
  );
};

export interface ConfiguredSecureFieldProps {
  id: string;
  readOnly: boolean;
  onReset: () => void;
}

export function ConfiguredSecretInput({ id, readOnly, onReset }: ConfiguredSecureFieldProps) {
  if (readOnly) {
    return <Input id={id} disabled={true} value="configured" />;
  }
  return <SecretInput id={id} onReset={onReset} isConfigured />;
}

function ConfiguredSecretTextArea({ id, readOnly, onReset }: ConfiguredSecureFieldProps) {
  if (readOnly) {
    return <TextArea id={id} disabled={true} value="configured" />;
  }
  return <SecretTextArea id={id} onReset={onReset} isConfigured />;
}

const OptionInput: FC<Props & { id: string }> = ({
  option,
  invalid,
  id,
  defaultValue,
  error,
  pathPrefix = '',
  secureFieldPathPrefix = '',
  readOnly = false,
  customValidator,
  onResetSecureField,
  onDeleteSubform,
  secureFields = {},
  getOptionMeta,
}) => {
  const styles = useStyles2(getStyles);
  const { control, register, setValue } = useFormContext();

  const optionMeta = getOptionMeta?.(option);

  const name = `${pathPrefix}${option.propertyName}`;

  const secureFieldKey = option.secure
    ? (option.secureFieldKey ?? `${secureFieldPathPrefix}${option.propertyName}`)
    : '';
  const isSecureFieldConfigured = secureFieldKey && secureFields?.[secureFieldKey];

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
          readOnly={readOnly}
        >
          {isSecureFieldConfigured ? (
            <ConfiguredSecretInput id={id} readOnly={readOnly} onReset={() => onResetSecureField?.(secureFieldKey)} />
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
          readOnly={readOnly}
        >
          {isSecureFieldConfigured ? (
            <ConfiguredSecretTextArea
              id={id}
              readOnly={readOnly}
              onReset={() => onResetSecureField?.(secureFieldKey)}
            />
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
      return isSecureFieldConfigured ? (
        <ConfiguredSecretInput
          id={id}
          readOnly={readOnly}
          onReset={() => {
            onResetSecureField?.(secureFieldKey);
            if (option.secure) {
              setValue(name, []);
            }
          }}
        />
      ) : (
        <Controller
          render={({ field: { value, onChange } }) => (
            <StringArrayInput
              readOnly={readOnly}
              inputType={option.secure ? option.inputType || 'password' : option.inputType}
              value={value}
              onChange={onChange}
            />
          )}
          control={control}
          name={name}
          defaultValue={defaultValue ?? []}
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

    case 'key_value_object_map':
      return (
        <Controller
          render={({ field: { value, onChange } }) => (
            <KeyValueObjectMapInput
              option={option}
              secureFieldPathPrefix={secureFieldPathPrefix}
              secureFields={secureFields}
              errors={isNestedErrors(error) ? error : undefined}
              readOnly={readOnly}
              value={value}
              onChange={onChange}
              onResetSecureField={onResetSecureField}
              getOptionMeta={getOptionMeta}
              onDeleteSubform={onDeleteSubform}
            />
          )}
          control={control}
          name={name}
          defaultValue={defaultValue ?? {}}
        />
      );

    default:
      console.error('Element not supported', option.element);
      return null;
  }
};

function isErrorArray(error: Props['error']): error is Array<DeepMap<FieldValues, FieldError>> {
  return Array.isArray(error);
}

function isNestedErrors(error: Props['error']): error is DeepMap<FieldValues, FieldError> {
  return !!error && !Array.isArray(error) && !isFieldError(error);
}

function isFieldError(error: FieldError | DeepMap<FieldValues, FieldError>): error is FieldError {
  return typeof error.type === 'string';
}

function getErrorMessage(error: Props['error']): string | undefined {
  if (error && !Array.isArray(error) && isFieldError(error)) {
    return error.message;
  }
  return undefined;
}

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
