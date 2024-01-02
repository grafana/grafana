import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents, getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import {
  Box,
  Button,
  CollapsableSection,
  Field,
  Input,
  InputControl,
  LinkButton,
  SecretInput,
  Select,
  Stack,
  Switch,
} from '@grafana/ui';

import { FormPrompt } from '../../core/components/FormPrompt/FormPrompt';
import { Page } from '../../core/components/Page/Page';

import { fieldMap, fields, sectionFields } from './fields';
import { FieldData, SSOProvider, SSOProviderDTO } from './types';
import { dataToDTO, dtoToData } from './utils/data';
import { isSelectableValue } from './utils/guards';

const appEvents = getAppEvents();

interface ProviderConfigProps {
  config?: SSOProvider;
  isLoading?: boolean;
  provider: string;
}

export const ProviderConfigForm = ({ config, provider, isLoading }: ProviderConfigProps) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, dirtyFields, isSubmitted },
  } = useForm({ defaultValues: dataToDTO(config) });
  const [isSaving, setIsSaving] = useState(false);
  const [isSecretConfigured, setIsSecretConfigured] = useState(!!config?.settings.clientSecret);
  const providerFields = fields[provider];
  const [submitError, setSubmitError] = useState(false);
  const dataSubmitted = isSubmitted && !submitError;
  const sections = sectionFields[provider];

  useEffect(() => {
    if (dataSubmitted) {
      locationService.push(`/admin/authentication`);
    }
  }, [dataSubmitted]);

  const onSubmit = async (data: SSOProviderDTO) => {
    setIsSaving(true);
    setSubmitError(false);
    const requestData = dtoToData(data);
    try {
      await getBackendSrv().put(`/api/v1/sso-settings/${provider}`, {
        ...config,
        settings: { ...config?.settings, ...requestData },
      });

      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Settings saved'],
      });
    } catch (error) {
      let message = '';
      if (isFetchError(error)) {
        message = error.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [message],
      });
      setSubmitError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (name: keyof SSOProvider['settings'], fieldData: FieldData) => {
    const fieldProps = {
      label: fieldData.label,
      required: !!fieldData.validation?.required,
      invalid: !!errors[name],
      error: fieldData.validation?.message,
      key: name,
      description: fieldData.description,
    };

    switch (fieldData.type) {
      case 'text':
        return (
          <Field {...fieldProps}>
            <Input
              {...register(name, { required: !!fieldData.validation?.required })}
              type={fieldData.type}
              id={name}
              autoComplete={'off'}
            />
          </Field>
        );
      case 'secret':
        return (
          <Field {...fieldProps} htmlFor={name}>
            <InputControl
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
        const options = isSelectableValue(watchOptions) ? watchOptions : [{ label: '', value: '' }];
        return (
          <Field {...fieldProps} htmlFor={name}>
            <InputControl
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
                    allowCustomValue
                    onChange={onChange}
                    onCreateOption={(v) => {
                      const customValue = { value: v, label: v };
                      onChange([...options, customValue]);
                    }}
                  />
                );
              }}
            />
          </Field>
        );
      case 'switch':
        return (
          <Field {...fieldProps}>
            <Switch {...register(name)} id={name} />
          </Field>
        );
      default:
        throw new Error(`Unknown field type: ${fieldData.type}`);
    }
  };

  return (
    <Page.Contents isLoading={isLoading}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '600px' }}>
        <>
          <FormPrompt
            // TODO Figure out why isDirty is not working
            confirmRedirect={!!Object.keys(dirtyFields).length && !dataSubmitted}
            onDiscard={() => {
              reset();
            }}
          />
          {sections ? (
            <Stack gap={2} direction={'column'}>
              {sections.map((section, index) => {
                return (
                  <CollapsableSection label={section.name} isOpen={index === 0} key={section.name}>
                    {section.fields.map((fieldName) => {
                      const field = fieldMap[fieldName];
                      if (!field) {
                        console.log('missing field:', fieldName);
                        return null;
                      }
                      return renderField(fieldName, field);
                    })}
                  </CollapsableSection>
                );
              })}
            </Stack>
          ) : (
            <>
              <Field label="Enabled">
                <Switch {...register('enabled')} id="enabled" label={'Enabled'} />
              </Field>
              {providerFields.map((fieldName) => {
                const field = fieldMap[fieldName];
                return renderField(fieldName, field);
              })}
            </>
          )}
          <Box display={'flex'} gap={2} marginTop={6}>
            <Field>
              <Button type={'submit'}>{isSaving ? 'Saving...' : 'Save'}</Button>
            </Field>
            <Field>
              <LinkButton href={'/admin/authentication'} variant={'secondary'}>
                Discard
              </LinkButton>
            </Field>
          </Box>
        </>
      </form>
    </Page.Contents>
  );
};
