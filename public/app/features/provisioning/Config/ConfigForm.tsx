import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import {
  Button,
  Checkbox,
  Combobox,
  ControlledCollapse,
  Field,
  Input,
  RadioButtonGroup,
  SecretInput,
  Stack,
  Switch,
} from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import { t, Trans } from 'app/core/internationalization';

import { TokenPermissionsInfo } from '../Shared/TokenPermissionsInfo';
import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';
import { RepositoryFormData } from '../types';
import { dataToSpec } from '../utils/data';

import { ConfigFormGithubCollapse } from './ConfigFormGithubCollapse';
import { getDefaultValues } from './defaults';

// This needs to be a function for translations to work
const getOptions = () => {
  const typeOptions = [
    { value: 'github', label: t('provisioning.config-form.option-github', 'GitHub') },
    { value: 'local', label: t('provisioning.config-form.option-local', 'Local') },
  ];

  const targetOptions = [
    { value: 'instance', label: t('provisioning.config-form.option-entire-instance', 'Entire instance') },
    { value: 'folder', label: t('provisioning.config-form.option-managed-folder', 'Managed folder') },
  ];

  return [typeOptions, targetOptions];
};

export interface ConfigFormProps {
  data?: Repository;
}
export function ConfigForm({ data }: ConfigFormProps) {
  const [submitData, request] = useCreateOrUpdateRepository(data?.metadata?.name);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
    setValue,
    watch,
    getValues,
  } = useForm<RepositoryFormData>({ defaultValues: getDefaultValues(data?.spec) });
  const isEdit = Boolean(data?.metadata?.name);
  const [tokenConfigured, setTokenConfigured] = useState(isEdit);
  const navigate = useNavigate();
  const [type, readOnly] = watch(['type', 'readOnly']);
  const [typeOptions, targetOptions] = useMemo(() => getOptions(), []);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (request.isSuccess) {
      const formData = getValues();
      reset(formData);
      setTimeout(() => {
        navigate('/admin/provisioning');
      }, 300);
    }
  }, [request.isSuccess, reset, getValues, navigate]);

  const onSubmit = async (form: RepositoryFormData) => {
    setIsLoading(true);
    const spec = dataToSpec(form);
    if (spec.github) {
      spec.github.token = form.token || data?.spec?.github?.token;
      // If we're still keeping this as GitHub, persist the old token. If we set a new one, it'll be re-encrypted into here.
      spec.github.encryptedToken = data?.spec?.github?.encryptedToken;
    }
    await submitData(spec);
    setIsLoading(false);
  };

  // NOTE: We do not want the lint option to be listed.
  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 700 }}>
      <FormPrompt onDiscard={reset} confirmRedirect={isDirty} />
      <Field label={t('provisioning.config-form.label-repository-type', 'Repository type')}>
        <Controller
          name={'type'}
          control={control}
          render={({ field: { ref, onChange, ...field } }) => {
            return (
              <Combobox
                options={typeOptions}
                onChange={(value) => onChange(value?.value)}
                placeholder={t('provisioning.config-form.placeholder-select-repository-type', 'Select repository type')}
                disabled={!!data?.spec}
                {...field}
              />
            );
          }}
        />
      </Field>
      <Field
        label={t('provisioning.config-form.label-title', 'Title')}
        description={t('provisioning.config-form.description-title', 'A human-readable name for the config')}
        invalid={!!errors.title}
        error={errors?.title?.message}
      >
        <Input
          {...register('title', {
            required: t('provisioning.config-form.error-required', 'This field is required.'),
          })}
          placeholder={t('provisioning.config-form.placeholder-my-config', 'My config')}
        />
      </Field>
      {type === 'github' && (
        <>
          <Field
            label={t('provisioning.config-form.label-github-token', 'GitHub token')}
            required
            error={errors?.token?.message}
            invalid={!!errors.token}
          >
            <Controller
              name={'token'}
              control={control}
              rules={{
                required: isEdit ? false : t('provisioning.config-form.error-required', 'This field is required.'),
              }}
              render={({ field: { ref, ...field } }) => {
                return (
                  <SecretInput
                    {...field}
                    id={'token'}
                    placeholder={t(
                      'provisioning.config-form.placeholder-github-token',
                      'ghp_yourTokenHere1234567890abcdEFGHijklMNOP'
                    )}
                    isConfigured={tokenConfigured}
                    onReset={() => {
                      setValue('token', '');
                      setTokenConfigured(false);
                    }}
                  />
                );
              }}
            />
          </Field>
          <TokenPermissionsInfo />
          <Field
            label={t('provisioning.config-form.label-repository-url', 'Repository URL')}
            error={errors?.url?.message}
            invalid={!!errors?.url}
            description={t('provisioning.config-form.description-repository-url', 'Enter the GitHub repository URL')}
            required
          >
            <Input
              {...register('url', {
                required: t('provisioning.config-form.error-required', 'This field is required.'),
                pattern: {
                  value: /^(?:https:\/\/github\.com\/)?[^/]+\/[^/]+$/,
                  message: t(
                    'provisioning.config-form.error-valid-github-url',
                    'Please enter a valid GitHub repository URL'
                  ),
                },
              })}
              placeholder={t(
                'provisioning.config-form.placeholder-github-url',
                'https://github.com/username/repo-name'
              )}
            />
          </Field>
          <Field label={t('provisioning.config-form.label-branch', 'Branch')}>
            <Input {...register('branch')} placeholder={t('provisioning.config-form.placeholder-branch', 'main')} />
          </Field>
          <Field
            label={t('provisioning.config-form.label-path', 'Path')}
            description={t('provisioning.config-form.description-path', 'Path to a subdirectory in the Git repository')}
          >
            <Input {...register('path')} />
          </Field>
        </>
      )}

      {type === 'local' && (
        <Field
          label={t('provisioning.config-form.label-local-path', 'Local path')}
          error={errors?.path?.message}
          invalid={!!errors?.path}
        >
          <Input
            {...register('path', {
              required: t('provisioning.config-form.error-required', 'This field is required.'),
            })}
            placeholder={t('provisioning.config-form.placeholder-local-path', '/path/to/repo')}
          />
        </Field>
      )}

      <Field>
        <Checkbox
          {...register('readOnly', {
            onChange: (e) => {
              if (e.target.checked) {
                setValue('prWorkflow', false);
              }
            },
          })}
          label={t('provisioning.finish-step.label-read-only', 'Read only')}
          description={t(
            'provisioning.config-form.description-read-only',
            "Resources can't be modified through Grafana."
          )}
        />
      </Field>

      <Field>
        <Checkbox
          disabled={readOnly}
          {...register('prWorkflow')}
          label={t('provisioning.config-form.label-pr-workflow', 'Enable pull request option when saving')}
          description={
            <Trans i18nKey="provisioning.finish-step.description-webhooks-enable">
              Allows users to choose whether to open a pull request when saving changes. If the repository does not
              allow direct changes to the main branch, a pull request may still be required.
            </Trans>
          }
        />
      </Field>
      {type === 'github' && <ConfigFormGithubCollapse register={register} />}

      <ControlledCollapse
        label={t('provisioning.config-form.label-automatic-pulling', 'Automatic pulling')}
        isOpen={false}
      >
        <Field
          label={t('provisioning.config-form.label-enabled', 'Enabled')}
          description={t(
            'provisioning.config-form.description-enabled',
            'Once automatic pulling is enabled, the target cannot be changed.'
          )}
        >
          <Switch {...register('sync.enabled')} id={'sync.enabled'} />
        </Field>
        <Field
          label={t('provisioning.config-form.label-target', 'Target')}
          required
          error={errors?.sync?.target?.message}
          invalid={!!errors?.sync?.target}
        >
          <Controller
            name={'sync.target'}
            control={control}
            rules={{ required: t('provisioning.config-form.error-required', 'This field is required.') }}
            render={({ field: { ref, onChange, ...field } }) => {
              return (
                <RadioButtonGroup
                  options={targetOptions}
                  onChange={onChange}
                  disabled={Boolean(data?.status?.sync.state)}
                  {...field}
                />
              );
            }}
          />
        </Field>
        <Field label={t('provisioning.config-form.label-interval-seconds', 'Interval (seconds)')}>
          <Input
            {...register('sync.intervalSeconds', { valueAsNumber: true })}
            type={'number'}
            placeholder={t('provisioning.config-form.placeholder-interval-seconds', '60')}
          />
        </Field>
      </ControlledCollapse>

      <Stack gap={2}>
        <Button type={'submit'} disabled={isLoading}>
          {isLoading
            ? t('provisioning.config-form.button-saving', 'Saving...')
            : t('provisioning.config-form.button-save', 'Save')}
        </Button>
      </Stack>
    </form>
  );
}
