import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents, getBackendSrv, isFetchError, locationService, reportInteraction } from '@grafana/runtime';
import {
  Box,
  Button,
  CollapsableSection,
  ConfirmModal,
  Dropdown,
  Field,
  IconButton,
  LinkButton,
  Menu,
  Stack,
  Switch,
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { FormPrompt } from '../../core/components/FormPrompt/FormPrompt';
import { Page } from '../../core/components/Page/Page';

import { FieldRenderer } from './FieldRenderer';
import { sectionFields } from './fields';
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
    getValues,
    unregister,
    formState: { errors, dirtyFields, isSubmitted },
  } = useForm({ defaultValues: dataToDTO(config), mode: 'onSubmit', reValidateMode: 'onChange' });
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const dataSubmitted = isSubmitted && !submitError;
  const sections = sectionFields[provider];
  const [resetConfig, setResetConfig] = useState(false);

  const additionalActionsMenu = (
    <Menu>
      <Menu.Item
        label={t(
          'auth-config.provider-config-form.additional-actions-menu.label-reset-to-default-values',
          'Reset to default values'
        )}
        icon="history-alt"
        onClick={() => {
          setResetConfig(true);
        }}
      />
    </Menu>
  );

  const onSubmit = async (data: SSOProviderDTO) => {
    setIsSaving(true);
    setSubmitError(false);
    const requestData = dtoToData(data, provider);
    try {
      await getBackendSrv().put(
        `/api/v1/sso-settings/${provider}`,
        {
          id: config?.id,
          provider: config?.provider,
          settings: { ...requestData },
        },
        {
          showErrorAlert: false,
        }
      );

      reportInteraction('grafana_authentication_ssosettings_saved', {
        provider,
        enabled: requestData.enabled,
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
      setIsSaving(false);
    }
  };

  const onResetConfig = async () => {
    try {
      await getBackendSrv().delete(`/api/v1/sso-settings/${provider}`, undefined, { showSuccessAlert: false });
      reportInteraction('grafana_authentication_ssosettings_removed', {
        provider,
      });

      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Settings reset to defaults'],
      });
      setTimeout(() => {
        locationService.push(`/admin/authentication`);
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
    }
  };

  const isEnabled = config?.settings.enabled;

  const onSaveAttempt = (toggleEnabled: boolean) => {
    reportInteraction('grafana_authentication_ssosettings_save_attempt', {
      provider,
      enabled: toggleEnabled ? !isEnabled : isEnabled,
    });

    if (toggleEnabled) {
      setValue('enabled', !isEnabled);
    }
  };

  return (
    <Page.Contents isLoading={isLoading}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '600px' }}>
        <FormPrompt
          confirmRedirect={!!Object.keys(dirtyFields).length && !dataSubmitted}
          onDiscard={() => {
            reportInteraction('grafana_authentication_ssosettings_abandoned', {
              provider,
            });
            reset();
          }}
        />
        <Field label={t('auth-config.provider-config-form.label-enabled', 'Enabled')} hidden={true}>
          <Switch
            {...register('enabled')}
            id="enabled"
            label={t('auth-config.provider-config-form.enabled-label-enabled', 'Enabled')}
          />
        </Field>
        <Stack gap={2} direction={'column'}>
          {sections
            .filter((section) => !section.hidden)
            .map((section, index) => {
              return (
                <CollapsableSection label={section.name} isOpen={index === 0} key={section.name}>
                  {section.fields
                    .filter((field) => (typeof field !== 'string' ? !field.hidden : true))
                    .map((field) => {
                      return (
                        <FieldRenderer
                          key={typeof field === 'string' ? field : field.name}
                          field={field}
                          control={control}
                          errors={errors}
                          setValue={setValue}
                          getValues={getValues}
                          register={register}
                          watch={watch}
                          unregister={unregister}
                          provider={provider}
                          secretConfigured={!!config?.settings.clientSecret}
                        />
                      );
                    })}
                </CollapsableSection>
              );
            })}
        </Stack>
        <Box display={'flex'} gap={2} marginTop={5}>
          <Stack alignItems={'center'} gap={2}>
            <Button
              type={'submit'}
              disabled={isSaving}
              onClick={() => onSaveAttempt(true)}
              variant={isEnabled ? 'secondary' : undefined}
            >
              {isSaving ? (isEnabled ? 'Disabling...' : 'Saving...') : isEnabled ? 'Disable' : 'Save and enable'}
            </Button>

            <Button type={'submit'} disabled={isSaving} variant={'secondary'} onClick={() => onSaveAttempt(false)}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <LinkButton href={'/admin/authentication'} variant={'secondary'}>
              <Trans i18nKey="auth-config.provider-config-form.discard">Discard</Trans>
            </LinkButton>

            <Dropdown overlay={additionalActionsMenu} placement="bottom-start">
              <IconButton
                tooltip={t('auth-config.provider-config-form.tooltip-more-actions', 'More actions')}
                title={t('auth-config.provider-config-form.title-more-actions', 'More actions')}
                tooltipPlacement="top"
                size="md"
                variant="secondary"
                name="ellipsis-v"
                hidden={config?.source === 'system'}
              />
            </Dropdown>
          </Stack>
        </Box>
      </form>
      {resetConfig && (
        <ConfirmModal
          isOpen
          icon="trash-alt"
          title={t('auth-config.provider-config-form.title-reset', 'Reset')}
          body={
            <Stack direction={'column'} gap={3}>
              <span>
                <Trans i18nKey="auth-config.provider-config-form.reset-configuration">
                  Are you sure you want to reset this configuration?
                </Trans>
              </span>
              <small>
                <Trans i18nKey="auth-config.provider-config-form.reset-configuration-description">
                  After resetting these settings Grafana will use the provider configuration from the system (config
                  file/environment variables) if any.
                </Trans>
              </small>
            </Stack>
          }
          confirmText="Reset"
          onDismiss={() => setResetConfig(false)}
          onConfirm={async () => {
            await onResetConfig();
            setResetConfig(false);
          }}
        />
      )}
    </Page.Contents>
  );
};
