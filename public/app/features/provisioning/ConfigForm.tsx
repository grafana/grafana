import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import {
  Field,
  Combobox,
  SecretInput,
  Input,
  Button,
  Switch,
  TextLink,
  ControlledCollapse,
  FieldSet,
  Stack,
} from '@grafana/ui';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { Repository, RepositorySpec } from './api';
import { useCreateOrUpdateRepository } from './hooks';
import { RepositoryFormData } from './types';
import { dataToSpec, specToData } from './utils/data';

const typeOptions = ['GitHub', 'Local', 'S3'].map((label) => ({ label, value: label.toLowerCase() }));
const appEvents = getAppEvents();

function getDefaultValues(repository?: RepositorySpec): RepositoryFormData {
  if (!repository) {
    return {
      type: 'github',
      title: '',
      token: '',
      owner: '',
      repository: '',
      branch: '',
      linting: false,
      branchWorkflow: false,
      editing: {
        create: false,
        delete: false,
        update: false,
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

  const onSubmit = (data: RepositoryFormData) => {
    const spec = dataToSpec(data);
    submitData(spec);
  };

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
          <ControlledCollapse collapsible label="Access Token Permissions" isOpen>
            <p>
              To create a new Access Token, navigate to{' '}
              <TextLink external href="https://github.com/settings/tokens">
                Personal Access Tokens
              </TextLink>{' '}
              and create a click &quot;Generate new token.&quot;
            </p>

            <p>Ensure that your token has the following permissions:</p>

            <b>For all repositories:</b>
            <pre>public_repo, repo:status, repo_deployment, read:packages, read:user, user:email</pre>

            <b>For GitHub projects:</b>
            <pre>read:org, read:project</pre>

            <b>An extra setting is required for private repositories:</b>
            <pre>repo (Full control of private repositories)</pre>
          </ControlledCollapse>
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
          <Field label={'Repository owner'} error={errors?.owner?.message} invalid={!!errors?.owner}>
            <Input {...register('owner', { required: 'This field is required.' })} placeholder={'test'} />
          </Field>
          <Field label={'Repository name'} error={errors?.repository?.message} invalid={!!errors?.repository}>
            <Input {...register('repository', { required: 'This field is required.' })} placeholder={'example'} />
          </Field>
          <Field label={'Branch'} error={errors?.branch?.message} invalid={!!errors?.branch}>
            <Input {...register('branch')} placeholder={'main'} />
          </Field>
          <Field label={'Enable branch workflow'}>
            <Switch {...register('branchWorkflow')} id={'branchWorkflow'} />
          </Field>
          <Field label={'Show dashboard previews'}>
            <Switch {...register('generateDashboardPreviews')} id={'generateDashboardPreviews'} />
          </Field>
          <Field label={'Lint pull requests'}>
            <Switch {...register('pullRequestLinter')} id={'pullRequestLinter'} />
          </Field>
        </>
      )}

      {type === 'local' && (
        <Field label={'Local path'} error={errors?.path?.message} invalid={!!errors?.path}>
          <Input {...register('path', { required: 'This field is required.' })} placeholder={'/path/to/repo'} />
        </Field>
      )}

      {type === 's3' && (
        <>
          <Field label={'S3 bucket'} error={errors?.bucket?.message} invalid={!!errors?.bucket}>
            <Input {...register('bucket', { required: 'This field is required.' })} placeholder={'bucket-name'} />
          </Field>
          <Field label={'S3 region'} error={errors?.region?.message} invalid={!!errors?.region}>
            <Input {...register('region', { required: 'This field is required.' })} placeholder={'us-west-2'} />
          </Field>
        </>
      )}
      <Field label={'Target folder'}>
        <Controller
          control={control}
          name={'folder'}
          render={({ field: { ref, ...field } }) => <FolderPicker {...field} />}
        />
      </Field>
      <Field label={'Linting'}>
        <Switch {...register('linting')} id={'linting'} />
      </Field>
      <FieldSet label={'Editing options'}>
        <Field label={'Create'} description={'Enable creating files on repository'}>
          <Switch {...register('editing.create')} id={'editing.create'} />
        </Field>
        <Field label={'Update'} description={'Enable updating files on repository'}>
          <Switch {...register('editing.update')} id={'editing.update'} />
        </Field>
        <Field label={'Delete'} description={'Enable deleting files on repository'}>
          <Switch {...register('editing.delete')} id={'editing.delete'} />
        </Field>
      </FieldSet>
      <Stack gap={2}>
        <Button type={'submit'} disabled={request.isLoading}>
          {request.isLoading ? 'Saving...' : 'Save'}
        </Button>
      </Stack>
    </form>
  );
}
