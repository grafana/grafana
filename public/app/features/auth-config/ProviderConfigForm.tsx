import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents, getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { Box, Button, CollapsableSection, Field, LinkButton, Stack, Switch } from '@grafana/ui';

import { FormPrompt } from '../../core/components/FormPrompt/FormPrompt';
import { Page } from '../../core/components/Page/Page';

import { FieldRenderer } from './FieldRenderer';
import { fields, sectionFields } from './fields';
import { SSOProvider, SSOProviderDTO } from './types';
import { dataToDTO, dtoToData } from './utils/data';

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
    unregister,
    formState: { errors, dirtyFields, isSubmitted },
  } = useForm({ defaultValues: dataToDTO(config), reValidateMode: 'onSubmit' });
  const [isSaving, setIsSaving] = useState(false);
  const providerFields = fields[provider];
  const [submitError, setSubmitError] = useState(false);
  const dataSubmitted = isSubmitted && !submitError;
  const sections = sectionFields[provider];

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
      reset(data);
      // Delay redirect so the form state can update
      setTimeout(() => {
        locationService.push(`/admin/authentication`);
      }, 300);
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
          <Field label="Enabled">
            <Switch {...register('enabled')} id="enabled" label={'Enabled'} />
          </Field>
          {sections ? (
            <Stack gap={2} direction={'column'}>
              {sections.map((section, index) => {
                return (
                  <CollapsableSection label={section.name} isOpen={index === 0} key={section.name}>
                    {section.fields.map((field) => {
                      return (
                        <FieldRenderer
                          key={typeof field === 'string' ? field : field.name}
                          field={field}
                          control={control}
                          errors={errors}
                          setValue={setValue}
                          register={register}
                          watch={watch}
                          unregister={unregister}
                          secretConfigured={!!config?.settings.clientSecret}
                        />
                      );
                    })}
                  </CollapsableSection>
                );
              })}
            </Stack>
          ) : (
            <>
              {providerFields.map((field) => {
                return (
                  <FieldRenderer
                    key={field}
                    field={field}
                    control={control}
                    errors={errors}
                    setValue={setValue}
                    register={register}
                    watch={watch}
                    unregister={unregister}
                    secretConfigured={!!config?.settings.clientSecret}
                  />
                );
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
