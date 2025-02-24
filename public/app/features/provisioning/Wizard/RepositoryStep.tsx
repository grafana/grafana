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
import { TokenPermissionsInfo } from '../TokenPermissionsInfo';
import { useCreateRepositoryTestMutation } from '../api';
import { RepositorySpec } from '../api/endpoints.gen';
import { useCreateOrUpdateRepository } from '../hooks';
import { dataToSpec } from '../utils/data';

import { RequestErrorAlert } from './RequestErrorAlert';
import { WizardFormData } from './types';

interface Props {
  onStatusChange: (success: boolean) => void;
}

const AdvancedSettingsFields = () => {
  const { register } = useFormContext<WizardFormData>();

  return (
    <ControlledCollapse label="Advanced settings" isOpen={true}>
      <Field label={'Enable sync'}>
        <Switch {...register('repository.sync.enabled')} />
      </Field>
      <Field label={'Sync interval (seconds)'}>
        <Input
          {...register('repository.sync.intervalSeconds', { valueAsNumber: true })}
          type={'number'}
          placeholder={'60'}
        />
      </Field>
    </ControlledCollapse>
  );
};

interface WorkflowsFieldProps {
  type: RepositorySpec['type'];
}

const WorkflowsField = ({ type }: WorkflowsFieldProps) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  return (
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
  );
};

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
  const [submitData, verifyRequest] = useCreateOrUpdateRepository(repoName);
  const [testConfig, testConfigRequest] = useCreateRepositoryTestMutation();

  const handleVerify = async () => {
    const formData = getValues();
    const spec = dataToSpec(formData.repository);
    if (formData.repository.type === 'github' && spec.github) {
      spec.github.token = formData.repository.token || '';
    }
    try {
      const testResponse = await testConfig({ name: 'new', body: { spec } });

      if ('error' in testResponse || !testResponse.data?.success) {
        onStatusChange(false);
        return;
      }

      await submitData(spec);
    } catch (error) {
      console.error('Repository verification failed:', error);
      onStatusChange(false);
    }
  };

  useEffect(() => {
    const appEvents = getAppEvents();
    if (verifyRequest.isSuccess) {
      if (verifyRequest.data?.metadata?.name) {
        setValue('repositoryName', verifyRequest.data.metadata.name);
        appEvents.publish({
          type: AppEvents.alertSuccess.name,
          payload: ['Repository settings verified successfully'],
        });
      }
    } else if (verifyRequest.isError) {
      onStatusChange(false);
    }
  }, [verifyRequest.isSuccess, verifyRequest.isError, verifyRequest.data, setValue, onStatusChange]);

  if (type === 'github') {
    return (
      <FieldSet label="2. Configure repository">
        <Stack direction="column" gap={1}>
          {testConfigRequest.isError && (
            <RequestErrorAlert request={testConfigRequest} title="Repository test failed" />
          )}
          {verifyRequest.isError && (
            <RequestErrorAlert request={verifyRequest} title="Repository verification failed" />
          )}
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

          <Field label={'Show dashboard previews'}>
            <Switch {...register('repository.generateDashboardPreviews')} />
          </Field>

          <WorkflowsField type={type} />
          <AdvancedSettingsFields />

          <Stack direction="row" gap={2}>
            <Button
              onClick={handleVerify}
              disabled={verifyRequest.isLoading || testConfigRequest.isLoading}
              icon={verifyRequest.isLoading || testConfigRequest.isLoading ? 'spinner' : 'check-circle'}
            >
              {verifyRequest.isLoading || testConfigRequest.isLoading ? 'Verifying...' : 'Connect & verify'}
            </Button>
          </Stack>
        </Stack>
      </FieldSet>
    );
  }

  if (type === 'local') {
    return (
      <FieldSet label="2. Configure repository">
        <Stack direction="column" gap={2}>
          {(testConfigRequest.isError || verifyRequest.isError) && (
            <RequestErrorAlert
              request={testConfigRequest.isError ? testConfigRequest : verifyRequest}
              title="Repository verification failed"
            />
          )}

          <Field label={'Local path'} error={errors.repository?.path?.message} invalid={!!errors.repository?.path}>
            <Input
              {...register('repository.path', { required: 'This field is required.' })}
              placeholder={'/path/to/repo'}
            />
          </Field>

          <WorkflowsField type={type} />
          <AdvancedSettingsFields />

          <Stack direction="row" gap={2}>
            <Button
              onClick={handleVerify}
              disabled={verifyRequest.isLoading || testConfigRequest.isLoading}
              icon={verifyRequest.isLoading || testConfigRequest.isLoading ? 'spinner' : 'check-circle'}
            >
              {verifyRequest.isLoading || testConfigRequest.isLoading ? 'Verifying...' : 'Connect & verify'}
            </Button>
          </Stack>
        </Stack>
      </FieldSet>
    );
  }

  return null;
}
