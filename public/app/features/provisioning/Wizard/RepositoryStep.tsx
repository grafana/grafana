import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, MultiCombobox, SecretInput, Stack, Switch } from '@grafana/ui';

import { TokenPermissionsInfo } from '../TokenPermissionsInfo';
import { useCreateOrUpdateRepository } from '../hooks';
import { dataToSpec } from '../utils/data';

import { WizardFormData } from './types';

const workflowOptions = [
  { label: 'Push', value: 'push' },
  { label: 'Branch', value: 'branch' },
];

export function RepositoryStep() {
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<WizardFormData>();
  const [submitData, request] = useCreateOrUpdateRepository();
  const appEvents = getAppEvents();

  const type = watch('repository.type');
  const [tokenConfigured, setTokenConfigured] = useState(false);

  const handleConnect = async () => {
    const formData = getValues();
    const response = await submitData(
      dataToSpec({
        ...formData.repository,
        url: formData.repository.url ?? '',
      })
    );

    if (response.data?.metadata?.name) {
      setValue('repositoryName', response.data.metadata.name);
    }
  };

  // Handle success/error states
  if (request.isSuccess) {
    appEvents.publish({
      type: AppEvents.alertSuccess.name,
      payload: ['Repository settings saved'],
    });
  }

  if (request.isError) {
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: ['Failed to save repository settings', request.error],
    });
  }

  if (type === 'github') {
    return (
      <FieldSet label="2. Configure repository">
        <div>
          <TokenPermissionsInfo />

          <Field
            label={'Token'}
            required
            error={errors.repository?.token?.message}
            invalid={!!errors.repository?.token}
          >
            <Controller
              name={'repository.token'}
              control={control}
              rules={{ required: 'This field is required.' }}
              render={({ field: { ref, ...field } }) => {
                return (
                  <SecretInput
                    {...field}
                    id={'token'}
                    placeholder={'ghp_yourTokenHere1234567890abcdEFGHijklMNOP'}
                    isConfigured={tokenConfigured}
                    onReset={() => {
                      setValue('repository.token', '');
                      setTokenConfigured(false);
                    }}
                  />
                );
              }}
            />
          </Field>

          <Field
            label={'Repository URL'}
            error={errors.repository?.url?.message}
            invalid={!!errors.repository?.url}
            description={'Enter the GitHub repository URL'}
            required
          >
            <Input
              {...register('repository.url', {
                required: 'This field is required.',
                pattern: {
                  value: /^(?:https:\/\/github\.com\/)?[^/]+\/[^/]+$/,
                  message: 'Please enter a valid GitHub repository URL',
                },
              })}
              placeholder={'https://github.com/username/repo-name'}
            />
          </Field>

          <Field label={'Branch'} error={errors.repository?.branch?.message} invalid={!!errors.repository?.branch}>
            <Input {...register('repository.branch')} placeholder={'main'} />
          </Field>

          <Field
            label={'Workflows'}
            required
            error={errors.repository?.workflows?.message}
            invalid={!!errors.repository?.workflows}
          >
            <Controller
              name={'repository.workflows'}
              control={control}
              rules={{ required: 'This field is required.' }}
              render={({ field: { ref, ...field } }) => (
                <MultiCombobox options={workflowOptions} placeholder={'Select workflows'} {...field} />
              )}
            />
          </Field>

          <Field label={'Show dashboard previews'}>
            <Switch {...register('repository.generateDashboardPreviews')} />
          </Field>

          <Stack gap={2}>
            <Button
              onClick={handleConnect}
              disabled={request.isLoading}
              icon={request.isLoading ? 'spinner' : 'check-circle'}
            >
              {request.isLoading ? 'Connecting...' : 'Connect & verify'}
            </Button>
          </Stack>
        </div>
      </FieldSet>
    );
  }

  if (type === 'local') {
    return (
      <FieldSet label="2. Configure repository">
        <Field label={'Local path'} error={errors.repository?.path?.message} invalid={!!errors.repository?.path}>
          <Input
            {...register('repository.path', { required: 'This field is required.' })}
            placeholder={'/path/to/repo'}
          />
        </Field>
      </FieldSet>
    );
  }

  return null;
}
