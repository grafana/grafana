import { useState, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import {
  Field,
  FieldSet,
  Input,
  MultiCombobox,
  SecretInput,
  Stack,
  Switch,
  ControlledCollapse,
  Button,
} from '@grafana/ui';

import { getWorkflowOptions } from '../ConfigForm';
import { ConfigFormGithubCollpase } from '../ConfigFormGithubCollapse';
import { TokenPermissionsInfo } from '../TokenPermissionsInfo';
import { useCreateRepositoryTestMutation } from '../api';
import { useCreateOrUpdateRepository } from '../hooks';
import { dataToSpec } from '../utils/data';

import { RequestErrorAlert } from './RequestErrorAlert';
import { WizardFormData } from './types';

interface Props {
  onStatusChange: (success: boolean) => void;
}

export function RepositoryStep({ onStatusChange }: Props) {
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const type = watch('repository.type');
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const repoName = watch('repositoryName');
  const [submitData, saveRequest] = useCreateOrUpdateRepository(repoName);
  const [testConfig, testConfigRequest] = useCreateRepositoryTestMutation();

  const isLoading = saveRequest.isLoading || testConfigRequest.isLoading;
  const errorRequest = testConfigRequest.isError ? testConfigRequest : saveRequest.isError ? saveRequest : null;

  const handleVerify = async () => {
    const formData = getValues();
    const spec = dataToSpec(formData.repository);

    try {
      const testResponse = await testConfig({ name: 'new', body: { spec } });
      if ('error' in testResponse || !testResponse.data?.success) {
        onStatusChange(false);
        return;
      }
      onStatusChange(true);
      await submitData(spec);
    } catch (error) {
      console.error('Repository connection failed:', error);
      onStatusChange(false);
    }
  };

  useEffect(() => {
    const appEvents = getAppEvents();
    if (saveRequest.isSuccess) {
      if (saveRequest.data?.metadata?.name) {
        setValue('repositoryName', saveRequest.data.metadata.name);
        appEvents.publish({
          type: AppEvents.alertSuccess.name,
          payload: ['Repository connected successfully'],
        });
      }
    } else if (saveRequest.isError) {
      onStatusChange(false);
    }
  }, [saveRequest.isSuccess, saveRequest.isError, saveRequest.data, setValue, onStatusChange]);

  const isGithub = type === 'github';

  return (
    <FieldSet label="2. Configure repository">
      <Stack direction="column">
        <RequestErrorAlert request={errorRequest} title="Repository verification failed" />

        {isGithub && (
          <>
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
          </>
        )}

        {type === 'local' && (
          <Field label={'Local path'} error={errors.repository?.path?.message} invalid={!!errors.repository?.path}>
            <Input
              {...register('repository.path', { required: 'This field is required.' })}
              placeholder={'/path/to/repo'}
            />
          </Field>
        )}

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
            render={({ field: { ref, onChange, ...field } }) => {
              return (
                <MultiCombobox
                  options={getWorkflowOptions(type)}
                  placeholder={'Readonly repository'}
                  onChange={(val) => {
                    onChange(val.map((v) => v.value));
                  }}
                  {...field}
                />
              );
            }}
          />
        </Field>

        {isGithub && (
          <ConfigFormGithubCollpase
            previews={
              <Switch
                {...register('repository.generateDashboardPreviews')}
                id={'repository.generateDashboardPreviews'}
              />
            }
          />
        )}

        <ControlledCollapse label="Advanced settings" isOpen={false}>
          <Field label={'Enable automatic pulling'} description="The repository will periodically pull changes">
            <Switch {...register('repository.sync.enabled')} />
          </Field>
          <Field label={'Interval (seconds)'}>
            <Input
              {...register('repository.sync.intervalSeconds', { valueAsNumber: true })}
              type={'number'}
              placeholder={'60'}
            />
          </Field>
        </ControlledCollapse>

        <Stack>
          <Button onClick={handleVerify} disabled={isLoading} icon={isLoading ? 'spinner' : 'check-circle'}>
            {isLoading ? 'Verifying...' : 'Connect & verify'}
          </Button>
        </Stack>
      </Stack>
    </FieldSet>
  );
}
