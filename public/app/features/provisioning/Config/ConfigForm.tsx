import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
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
import { Repository, useGetRepositoryRefsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { TokenPermissionsInfo } from '../Shared/TokenPermissionsInfo';
import { getGitProviderFields, getLocalProviderFields } from '../Wizard/fields';
import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';
import { RepositoryFormData } from '../types';
import { dataToSpec } from '../utils/data';
import { getHasTokenInstructions } from '../utils/git';
import { getRepositoryTypeConfig, isGitProvider } from '../utils/repositoryTypes';

import { ConfigFormGithubCollapse } from './ConfigFormGithubCollapse';
import { getDefaultValues } from './defaults';

// This needs to be a function for translations to work
const getTargetOptions = () => {
  return [
    { value: 'instance', label: t('provisioning.config-form.option-entire-instance', 'Entire instance') },
    { value: 'folder', label: t('provisioning.config-form.option-managed-folder', 'Managed folder') },
  ];
};

export interface ConfigFormProps {
  data?: Repository;
}
export function ConfigForm({ data }: ConfigFormProps) {
  const repositoryName = data?.metadata?.name;
  const [submitData, request] = useCreateOrUpdateRepository(repositoryName);
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

  const isEdit = Boolean(repositoryName);
  const [tokenConfigured, setTokenConfigured] = useState(isEdit);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [type, readOnly] = watch(['type', 'readOnly']);
  const targetOptions = useMemo(() => getTargetOptions(), []);
  const isGitBased = isGitProvider(type);

  const {
    data: refsData,
    isLoading: refsLoading,
    error: refsError,
  } = useGetRepositoryRefsQuery(!repositoryName || !isGitBased ? skipToken : { name: repositoryName });

  const branchOptions = useMemo(() => {
    if (!refsData?.items) {
      return [];
    }

    return refsData.items.map((ref) => ({
      label: ref.name,
      value: ref.name,
    }));
  }, [refsData?.items]);

  // Get field configurations based on provider type
  const gitFields = isGitBased ? getGitProviderFields(type) : null;
  const localFields = type === 'local' ? getLocalProviderFields(type) : null;
  const hasTokenInstructions = getHasTokenInstructions(type);

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
    try {
      const spec = dataToSpec(form);
      await submitData(spec, form.token);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 700 }}>
      <FormPrompt onDiscard={reset} confirmRedirect={isDirty} />
      <Stack direction="column" gap={2}>
        <Field noMargin label={t('provisioning.config-form.label-repository-type', 'Repository type')}>
          <Input value={getRepositoryTypeConfig(type)?.label || type} disabled />
        </Field>
        <Field
          noMargin
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
        {gitFields && (
          <>
            <Field
              noMargin
              label={gitFields.tokenConfig.label}
              required={gitFields.tokenConfig.required}
              error={errors?.token?.message}
              invalid={!!errors.token}
              description={gitFields.tokenConfig.description}
            >
              <Controller
                name={'token'}
                control={control}
                rules={{
                  required: isEdit ? false : gitFields.tokenConfig.validation?.required,
                }}
                render={({ field: { ref, ...field } }) => {
                  return (
                    <SecretInput
                      {...field}
                      id={'token'}
                      placeholder={gitFields.tokenConfig.placeholder}
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
            {gitFields.tokenUserConfig && (
              <Field
                noMargin
                label={gitFields.tokenUserConfig.label}
                required={gitFields.tokenUserConfig.required}
                error={errors?.tokenUser?.message}
                invalid={!!errors?.tokenUser}
                description={gitFields.tokenUserConfig.description}
              >
                <Input
                  {...register('tokenUser', {
                    required: gitFields.tokenUserConfig.validation?.required,
                  })}
                  placeholder={gitFields.tokenUserConfig.placeholder}
                />
              </Field>
            )}
            {hasTokenInstructions && <TokenPermissionsInfo type={type} />}
            <Field
              noMargin
              label={gitFields.urlConfig.label}
              error={errors?.url?.message}
              invalid={!!errors?.url}
              description={gitFields.urlConfig.description}
              required={gitFields.urlConfig.required}
            >
              <Input
                {...register('url', {
                  required: gitFields.urlConfig.validation?.required,
                  pattern: gitFields.urlConfig.validation?.pattern,
                })}
                placeholder={gitFields.urlConfig.placeholder}
              />
            </Field>
            <Field
              noMargin
              label={gitFields.branchConfig.label}
              description={gitFields.branchConfig.description}
              error={
                errors?.branch?.message ||
                (refsError ? t('provisioning.config-form.error-fetch-branches', 'Failed to fetch branches') : undefined)
              }
              invalid={Boolean(errors?.branch?.message || refsError)}
            >
              <Controller
                name="branch"
                control={control}
                rules={gitFields.branchConfig.validation}
                render={({ field: { ref, onChange, ...field } }) => (
                  <Combobox
                    invalid={Boolean(errors?.branch?.message || refsError)}
                    onChange={(option) => onChange(option?.value || '')}
                    placeholder={gitFields.branchConfig.placeholder}
                    options={branchOptions}
                    loading={refsLoading}
                    isClearable
                    {...field}
                  />
                )}
              />
            </Field>
            <Field noMargin label={gitFields.pathConfig.label} description={gitFields.pathConfig.description}>
              <Input {...register('path')} />
            </Field>
          </>
        )}

        {localFields && (
          <Field
            noMargin
            label={localFields.pathConfig.label}
            error={errors?.path?.message}
            invalid={!!errors?.path}
            description={localFields.pathConfig.description}
            required={localFields.pathConfig.required}
          >
            <Input
              {...register('path', {
                required: localFields.pathConfig.validation?.required,
              })}
              placeholder={localFields.pathConfig.placeholder}
            />
          </Field>
        )}

        <Field noMargin>
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

        {gitFields && (
          <Field noMargin>
            <Checkbox
              disabled={readOnly}
              {...register('prWorkflow')}
              label={gitFields.prWorkflowConfig.label}
              description={gitFields.prWorkflowConfig.description}
            />
          </Field>
        )}
        {type === 'github' && <ConfigFormGithubCollapse register={register} />}

        {isGitBased && (
          <ControlledCollapse
            label={t('provisioning.config-form.label-automatic-pulling', 'Automatic pulling')}
            isOpen={false}
          >
            <Stack direction="column" gap={2}>
              <Field
                noMargin
                label={t('provisioning.config-form.label-enabled', 'Enabled')}
                description={t(
                  'provisioning.config-form.description-enabled',
                  'Once automatic pulling is enabled, the target cannot be changed.'
                )}
              >
                <Switch {...register('sync.enabled')} id={'sync.enabled'} />
              </Field>
              <Field
                noMargin
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
              <Field noMargin label={t('provisioning.config-form.label-interval-seconds', 'Interval (seconds)')}>
                <Input
                  {...register('sync.intervalSeconds', { valueAsNumber: true })}
                  type={'number'}
                  placeholder={t('provisioning.config-form.placeholder-interval-seconds', '60')}
                />
              </Field>
            </Stack>
          </ControlledCollapse>
        )}

        <Stack gap={2}>
          <Button type={'submit'} disabled={isLoading}>
            {isLoading
              ? t('provisioning.config-form.button-saving', 'Saving...')
              : t('provisioning.config-form.button-save', 'Save')}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
