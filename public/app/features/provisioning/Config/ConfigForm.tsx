import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import {
  Button,
  Combobox,
  ComboboxOption,
  ControlledCollapse,
  Field,
  Input,
  MultiCombobox,
  RadioButtonGroup,
  SecretInput,
  Stack,
  Switch,
} from '@grafana/ui';
import { Repository, RepositorySpec } from 'app/api/clients/provisioning';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import { t } from 'app/core/internationalization';

import { TokenPermissionsInfo } from '../Shared/TokenPermissionsInfo';
import { useCreateOrUpdateRepository } from '../hooks';
import { RepositoryFormData, WorkflowOption } from '../types';
import { dataToSpec, specToData } from '../utils/data';

import { ConfigFormGithubCollapse } from './ConfigFormGithubCollapse';

export function getWorkflowOptions(type?: 'github' | 'local'): Array<ComboboxOption<WorkflowOption>> {
  const opts: Array<ComboboxOption<WorkflowOption>> = [
    {
      label: t('provisioning.config-form.option-branch', 'Branch'),
      value: 'branch',
      description: t('provisioning.config-form.description-branch', 'Create a branch (and pull request) for changes'),
    },
    {
      label: t('provisioning.config-form.option-write', 'Write'),
      value: 'write',
      description: t('provisioning.config-form.description-write', 'Allow writing updates to the remote repository'),
    },
  ];
  if (type === 'github') {
    return opts;
  }
  return opts.filter((opt) => opt.value === 'write'); // only write
}

export function getDefaultValues(repository?: RepositorySpec): RepositoryFormData {
  if (!repository) {
    return {
      type: 'github',
      title: 'Repository',
      token: '',
      url: '',
      branch: 'main',
      generateDashboardPreviews: true,
      workflows: ['branch', 'write'],
      path: 'grafana/',
      sync: {
        enabled: false,
        target: 'folder',
        intervalSeconds: 60,
      },
    };
  }
  return specToData(repository);
}

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
  const type = watch('type');

  const typeOptions = useMemo(
    () => [
      { value: 'github', label: t('provisioning.config-form.option-github', 'GitHub') },
      { value: 'local', label: t('provisioning.config-form.option-local', 'Local') },
    ],
    []
  );

  const targetOptions = useMemo(
    () => [
      { value: 'instance', label: t('provisioning.config-form.option-entire-instance', 'Entire instance') },
      { value: 'folder', label: t('provisioning.config-form.option-managed-folder', 'Managed folder') },
    ],
    []
  );

  useEffect(() => {
    if (request.isSuccess) {
      const formData = getValues();
      reset(formData);
      setTimeout(() => {
        navigate('/admin/provisioning');
      }, 300);
    }
  }, [request.isSuccess, reset, getValues, navigate]);

  const onSubmit = (form: RepositoryFormData) => {
    const spec = dataToSpec(form);
    if (spec.github) {
      spec.github.token = form.token || data?.spec?.github?.token;
      // If we're still keeping this as GitHub, persist the old token. If we set a new one, it'll be re-encrypted into here.
      spec.github.encryptedToken = data?.spec?.github?.encryptedToken;
    }
    submitData(spec);
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
            <Input {...register('path')} placeholder={t('provisioning.config-form.placeholder-path', 'grafana/')} />
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

      <Field
        label={t('provisioning.config-form.label-workflows', 'Workflows')}
        required
        error={errors?.workflows?.message}
        invalid={!!errors?.workflows}
        description={t(
          'provisioning.config-form.description-workflows-makes-repository',
          'No workflows makes the repository read only'
        )}
      >
        <Controller
          name={'workflows'}
          control={control}
          rules={{ required: t('provisioning.config-form.error-required', 'This field is required.') }}
          render={({ field: { ref, onChange, ...field } }) => (
            <MultiCombobox
              options={getWorkflowOptions(type)}
              placeholder={t('provisioning.config-form.placeholder-readonly-repository', 'Readonly repository')}
              onChange={(val) => {
                onChange(val.map((v) => v.value));
              }}
              {...field}
            />
          )}
        />
      </Field>

      {type === 'github' && (
        <ConfigFormGithubCollapse
          previews={<Switch {...register('generateDashboardPreviews')} id={'generateDashboardPreviews'} />}
        />
      )}

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
        <Button type={'submit'} disabled={request.isLoading}>
          {request.isLoading
            ? t('provisioning.config-form.button-saving', 'Saving...')
            : t('provisioning.config-form.button-save', 'Save')}
        </Button>
      </Stack>
    </form>
  );
}
