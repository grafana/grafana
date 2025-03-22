import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
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

import { TokenPermissionsInfo } from '../Shared/TokenPermissionsInfo';
import { useCreateOrUpdateRepository } from '../hooks';
import { RepositoryFormData, WorkflowOption } from '../types';
import { dataToSpec, specToData } from '../utils/data';

import { ConfigFormGithubCollapse } from './ConfigFormGithubCollapse';

const typeOptions = ['GitHub', 'Local'].map((label) => ({ label, value: label.toLowerCase() }));
const targetOptions = [
  { value: 'instance', label: 'Entire instance' },
  { value: 'folder', label: 'Managed folder' },
];

export function getWorkflowOptions(type?: 'github' | 'local'): Array<ComboboxOption<WorkflowOption>> {
  const opts: Array<ComboboxOption<WorkflowOption>> = [
    { label: 'Branch', value: 'branch', description: 'Create a branch (and pull request) for changes' },
    { label: 'Write', value: 'write', description: 'Allow writing updates to the remote repository' },
  ];
  if (type === 'github') {
    return opts;
  }
  return opts.filter((opt) => opt.value === 'write'); // only write
}

const appEvents = getAppEvents();

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

  useEffect(() => {
    if (request.isSuccess) {
      const formData = getValues();

      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Repository settings saved'],
      });
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
      <Field label={'Repository type'}>
        <Controller
          name={'type'}
          control={control}
          render={({ field: { ref, onChange, ...field } }) => {
            return (
              <Combobox
                options={typeOptions}
                onChange={(value) => onChange(value?.value)}
                placeholder={'Select repository type'}
                disabled={!!data?.spec}
                {...field}
              />
            );
          }}
        />
      </Field>
      <Field
        label={'Title'}
        description={'A human-readable name for the config'}
        invalid={!!errors.title}
        error={errors?.title?.message}
      >
        <Input {...register('title', { required: 'This field is required.' })} placeholder={'My config'} />
      </Field>
      {type === 'github' && (
        <>
          <Field label={'GitHub token'} required error={errors?.token?.message} invalid={!!errors.token}>
            <Controller
              name={'token'}
              control={control}
              rules={{ required: isEdit ? false : 'This field is required.' }}
              render={({ field: { ref, ...field } }) => {
                return (
                  <SecretInput
                    {...field}
                    id={'token'}
                    placeholder={'ghp_yourTokenHere1234567890abcdEFGHijklMNOP'}
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
            label={'Repository URL'}
            error={errors?.url?.message}
            invalid={!!errors?.url}
            description={'Enter the GitHub repository URL'}
            required
          >
            <Input
              {...register('url', {
                required: 'This field is required.',
                pattern: {
                  value: /^(?:https:\/\/github\.com\/)?[^/]+\/[^/]+$/,
                  message: 'Please enter a valid GitHub repository URL',
                },
              })}
              placeholder={'https://github.com/username/repo-name'}
            />
          </Field>
          <Field label={'Branch'}>
            <Input {...register('branch')} placeholder={'main'} />
          </Field>
          <Field label={'Path'} description={'Path to a subdirectory in the Git repository'}>
            <Input {...register('path')} placeholder={'grafana/'} />
          </Field>
        </>
      )}

      {type === 'local' && (
        <Field label={'Local path'} error={errors?.path?.message} invalid={!!errors?.path}>
          <Input {...register('path', { required: 'This field is required.' })} placeholder={'/path/to/repo'} />
        </Field>
      )}

      <Field
        label={'Workflows'}
        required
        error={errors?.workflows?.message}
        invalid={!!errors?.workflows}
        description="no workflows makes the repository read only"
      >
        <Controller
          name={'workflows'}
          control={control}
          rules={{ required: 'This field is required.' }}
          render={({ field: { ref, onChange, ...field } }) => (
            <MultiCombobox
              options={getWorkflowOptions(type)}
              placeholder={'Readonly repository'}
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

      <ControlledCollapse label="Automatic pulling" isOpen={false}>
        <Field label={'Enabled'} description={'Once automatic pulling is enabled, the target cannot be changed.'}>
          <Switch {...register('sync.enabled')} id={'sync.enabled'} />
        </Field>
        <Field label={'Target'} required error={errors?.sync?.target?.message} invalid={!!errors?.sync?.target}>
          <Controller
            name={'sync.target'}
            control={control}
            rules={{ required: 'This field is required.' }}
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
        <Field label={'Interval (seconds)'}>
          <Input {...register('sync.intervalSeconds', { valueAsNumber: true })} type={'number'} placeholder={'60'} />
        </Field>
      </ControlledCollapse>

      <Stack gap={2}>
        <Button type={'submit'} disabled={request.isLoading}>
          {request.isLoading ? 'Saving...' : 'Save'}
        </Button>
      </Stack>
    </form>
  );
}
