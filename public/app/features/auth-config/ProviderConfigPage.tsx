import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { AppEvents, NavModelItem } from '@grafana/data';
import { getAppEvents, getBackendSrv, isFetchError } from '@grafana/runtime';
import { Button, Field, Input, InputControl, LinkButton, SecretInput, Select, Stack, Switch } from '@grafana/ui';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { StoreState } from '../../types';

import { fieldMap, fields } from './fields';
import { loadProviders } from './state/actions';
import { SSOProvider, SSOProviderDTO, FieldData } from './types';
import { dataToDTO, dtoToData } from './utils/data';
import { isSelectableValue } from './utils/guards';

const appEvents = getAppEvents();
const getPageNav = (config?: SSOProvider): NavModelItem => {
  if (!config) {
    return {
      text: 'Authentication',
      subTitle: 'Configure authentication providers',
      icon: 'shield',
      id: 'authentication',
    };
  }

  return {
    text: config.settings.name || '',
    subTitle: `To configure ${config.settings.name} OAuth2 you must register your application with ${config.settings.name}. ${config.settings.name} will generate a Client ID and Client Secret for you to use.`,
    icon: config.settings.icon || 'shield',
    id: config.provider,
  };
};

interface RouteProps extends GrafanaRouteComponentProps<{ provider: string }> {}

function mapStateToProps(state: StoreState, props: RouteProps) {
  const { isLoading, providers } = state.authConfig;
  const { provider } = props.match.params;
  const config = providers.find((config) => config.provider === provider);
  return {
    config,
    isLoading,
    provider,
  };
}

const mapDispatchToProps = {
  loadProviders,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export type Props = ConnectedProps<typeof connector>;

/**
 * Separate the Page logic from the Content logic for easier testing.
 */
export const ProviderConfigPage = ({ config, loadProviders, isLoading, provider }: Props) => {
  const pageNav = getPageNav(config);

  useEffect(() => {
    loadProviders(provider);
  }, [loadProviders, provider]);

  if (!config) {
    return null;
  }
  return (
    <Page navId="authentication" pageNav={pageNav}>
      <ProviderConfig config={config} isLoading={isLoading} provider={provider} />
    </Page>
  );
};

export default connector(ProviderConfigPage);

interface ProviderConfigProps {
  config?: SSOProvider;
  isLoading?: boolean;
  provider: string;
}

export const ProviderConfig = ({ config, provider, isLoading }: ProviderConfigProps) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm({ defaultValues: dataToDTO(config) });
  const [isSaving, setIsSaving] = useState(false);
  const [isSecretConfigured, setIsSecretConfigured] = useState(!!config?.settings.clientSecret);
  const providerFields = fields[provider];
  const onSubmit = async (data: SSOProviderDTO) => {
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (name: keyof SSOProvider['settings'], fieldData: FieldData) => {
    switch (fieldData.type) {
      case 'text':
        return (
          <Field
            label={fieldData.label}
            required={!!fieldData.validation?.required}
            invalid={!!errors[name]}
            error={fieldData.validation?.message}
            key={name}
          >
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
          <Field
            label={fieldData.label}
            required={!!fieldData.validation?.required}
            invalid={!!errors[name]}
            error={fieldData.validation?.message}
            key={name}
            htmlFor={name}
          >
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
          <Field
            label={fieldData.label}
            htmlFor={name}
            key={name}
            invalid={!!errors[name]}
            error={fieldData.validation?.message}
          >
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
      default:
        throw new Error(`Unknown field type: ${fieldData.type}`);
    }
  };

  return (
    <Page.Contents isLoading={isLoading}>
      <Stack grow={1} direction={'column'}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '600px' }}>
          <>
            <FormPrompt
              // TODO Figure out why isDirty is not working
              confirmRedirect={!!Object.keys(dirtyFields).length}
              onDiscard={() => {
                reset();
              }}
            />
            <Field label="Enabled">
              <Switch {...register('enabled')} id="enabled" label={'Enabled'} />
            </Field>
            {providerFields.map((fieldName) => {
              const field = fieldMap[fieldName];
              return renderField(fieldName, field);
            })}
            <Stack gap={2}>
              <Field>
                <Button type={'submit'}>{isSaving ? 'Saving...' : 'Save'}</Button>
              </Field>
              <Field>
                <LinkButton href={'/admin/authentication'} variant={'secondary'}>
                  Discard
                </LinkButton>
              </Field>
            </Stack>
          </>
        </form>
      </Stack>
    </Page.Contents>
  );
};
