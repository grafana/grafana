import { css, cx } from '@emotion/css';
import { isEmpty } from 'lodash';
import React, { FC, useEffect } from 'react';
import { Controller, DeepMap, FieldError, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Button,
  Checkbox,
  Drawer,
  Field,
  Input,
  RadioButtonList,
  Select,
  Stack,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { NotificationChannelOption } from 'app/types';

import { defaultPayloadString } from '../../TemplateForm';

import { KeyValueMapInput } from './KeyValueMapInput';
import { StringArrayInput } from './StringArrayInput';
import { SubformArrayField } from './SubformArrayField';
import { SubformField } from './SubformField';
import { TemplateContentAndPreview } from './TemplateContentAndPreview';

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
  const { control, register, unregister, getValues, setValue } = useFormContext();
  const name = `${pathPrefix}${option.propertyName}`;

  // workaround for https://github.com/react-hook-form/react-hook-form/issues/4993#issuecomment-829012506
  useEffect(
    () => () => {
      unregister(name, { keepValue: false });
    },
    [unregister, name]
  );

  const showTemplateDropDown = option.placeholder.includes('{{ template');
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>('');

  function onSelectTemplate(template: string) {
    setSelectedTemplate(template);
  }

  useEffect(() => {
    Boolean(selectedTemplate) && setValue(name, selectedTemplate);
  }, [selectedTemplate, setValue, name]);

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
        <Stack direction="row" gap={1} alignItems="center">
          {showTemplateDropDown && <TemplatesPicker onSelect={onSelectTemplate} />}
          <Input
            id={id}
            readOnly={readOnly || determineReadOnly(option, getValues, pathIndex)}
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
        </Stack>
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
        <Stack direction="row" gap={1} alignItems="center">
          {showTemplateDropDown && <TemplatesPicker onSelect={onSelectTemplate} />}
          <TextArea
            id={id}
            readOnly={readOnly}
            invalid={invalid}
            placeholder={option.placeholder}
            {...register(name, {
              required: option.required ? 'Required' : false,
              validate: (v) =>
                option.validationRule !== '' ? validateOption(v, option.validationRule, option.required) : true,
            })}
          />
        </Stack>
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
  actions: css({
    flex: 0,
    justifyContent: 'flex-end',
    display: 'flex',
    gap: theme.spacing(1),
  }),
  templateContent: css({
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.primary,
    height: theme.spacing(100),
  }),
  templatePreview: css({
    flex: 1,
    display: 'flex',
  }),
  minEditorSize: css({
    minHeight: 300,
    minWidth: 300,
  }),
  templateEditor: css`
    width: 100%;
    height: 100%;
  `,
});

const validateOption = (value: string, validationRule: string, required: boolean) => {
  if (value === '' && !required) {
    return true;
  }

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
interface TemplatesPickerProps {
  onSelect: (temnplate: string) => void;
}
function TemplatesPicker({ onSelect }: TemplatesPickerProps) {
  const [showTemplates, setShowTemplates] = React.useState(false);

  return (
    <>
      <Button
        icon="plus"
        tooltip={'Select available template in this field'}
        onClick={() => setShowTemplates(true)}
        variant="secondary"
        aria-label={'Select available template from the list of available templates.'}
      >
        Select template
      </Button>

      {showTemplates && (
        <Drawer title="Select template" size="md" onClose={() => setShowTemplates(false)}>
          <TemplateSelector onSelect={onSelect} onClose={() => setShowTemplates(false)} />
        </Drawer>
      )}
    </>
  );
}

interface Template {
  name: string;
  content: string;
}
interface TemplateSelectorProps {
  onSelect: (template: string) => void;
  onClose: () => void;
}
function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const styles = useStyles2(getStyles);
  const [template, setTemplate] = React.useState<Template | undefined>(undefined);
  const options = [
    {
      label: `template1`,
      value: {
        name: 'template1',
        content: `{ { define "template1" } } { { if len.Values } } { { $first:= true } } { { range $refID, $value := .Values -} }
    { { if $first } } { { $first = false } } { { else } }, { { end } } { { $refID } }={ { $value } } { { end -} }
    { { else } } [no value]{ { end } } { { end } }  `,
      },
    },
    {
      label: 'Template 2',
      value: {
        name: 'template2',
        content: `{ { define "template2" } } { { if len.Values } } { { $first:= true } } { { range $refID, $value := .Values -} }
    { { if $first } } { { $first = false } } { { else } }, { { end } } { { $refID } }={ { $value } } { { end -} }
    { { else } } [no value]{ { end } } { { end } } `,
      },
    },
  ];
  return (
    <Stack direction="column" gap={1} justifyContent="space-between" height="100%">
      <Stack direction="column" gap={1}>
        <Select<Template>
          aria-label="Template"
          // defaultValue={}
          onChange={(value: SelectableValue<Template>, _) => {
            setTemplate(value?.value);
          }}
          options={options}
          width={50}
        />
        <TemplateContentAndPreview
          templateContent={template?.content ?? ''}
          payload={defaultPayloadString}
          templateName={template?.name ?? ''}
          setPayloadFormatError={() => {}}
          className={cx(styles.templatePreview, styles.minEditorSize)}
          payloadFormatError={null}
        />
      </Stack>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onSelect(getUseTemplateText(template?.name ?? ''));
            onClose();
          }}
        >
          Select
        </Button>
      </div>
    </Stack>
  );
}

function getUseTemplateText(templateName: string) {
  return `{{ template "${templateName}" . }}`;
}
