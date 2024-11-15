import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Field, Combobox, SecretInput, Input, Button, Switch } from '@grafana/ui';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { FolderPicker } from '../../core/components/Select/FolderPicker';

import { useCreateRepositoryMutation } from './api';

const typeOptions = ['GitHub', 'Local', 'S3'].map((label) => ({ label, value: label.toLowerCase() }));

export function ConfigForm() {
  const [submitData, request] = useCreateRepositoryMutation();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      type: '',
      token: '',
      owner: '',
      repository: '',
      folder: '',
      branchWorkflow: false,
      generateDashboardPreviews: false,
    },
  });
  const [tokenConfigured, setTokenConfigured] = useState(false);

  const watchType = watch('type');

  const onSubmit = (data: unknown) => {
    console.log('d', data);
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 600 }}>
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
                {...field}
              />
            );
          }}
        />
      </Field>
      {watchType === 'github' && (
        <>
          <Field label={'GitHub token'}>
            <Controller
              name={'token'}
              control={control}
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
          <Field label={'Resource folder'}>
            <Controller
              control={control}
              name={'folder'}
              render={({ field: { ref, ...field } }) => {
                return <FolderPicker {...field} />;
              }}
            />
          </Field>
          <Field label={'Commit directly to main'}>
            <Switch {...register('branchWorkflow')} />
          </Field>
          <Field label={'Show dashboard previews'}>
            <Switch {...register('generateDashboardPreviews')} />
          </Field>
        </>
      )}
      <Button type={'submit'}>Save</Button>
    </form>
  );
}
