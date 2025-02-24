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
import { useCreateRepositoryTestMutation, useListRepositoryQuery } from '../api';
import { RepositorySpec } from '../api/endpoints.gen';
import { useCreateOrUpdateRepository } from '../hooks';
import { dataToSpec } from '../utils/data';

import { RequestErrorAlert } from './RequestErrorAlert';
import { WizardFormData } from './types';

interface Props {
  onStatusChange: (success: boolean) => void;
}

interface RepositoryHealthProps {
  name: string;
  onHealthChange: (isHealthy: boolean) => void;
}

const RepositoryHealth = ({ name, onHealthChange }: RepositoryHealthProps) => {
  const { data: repoData } = useListRepositoryQuery({ watch: true });
  const repo = repoData?.items?.[0];
  console.log('r', repo);

  if (!repo) {
    return null;
  }

  return (
    repo?.status?.health?.healthy === false &&
    repo?.status?.health?.message && (
      <RequestErrorAlert
        error={{ message: repo.status.health.message.join('\n') }}
        title="Repository health check failed"
      />
    )
  );
};

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
  const [verify] = useCreateRepositoryTestMutation();

  const handleVerify = async () => {
    const formData = getValues();
    const spec = dataToSpec(formData.repository);
    if (formData.repository.type === 'github' && spec.github) {
      spec.github.token = formData.repository.token || '';
    }
    const test = await verify({ name: 'new', body: { spec } });
    console.log('t', test);
    await submitData(spec);
  };

  // Handle verification response
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
          {verifyRequest.isError && <RequestErrorAlert request={verifyRequest} />}
          {repoName && <RepositoryHealth name={repoName} onHealthChange={onStatusChange} />}
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
              disabled={verifyRequest.isLoading}
              icon={verifyRequest.isLoading ? 'spinner' : 'check-circle'}
            >
              {verifyRequest.isLoading ? 'Verifying...' : 'Connect & verify'}
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
          {verifyRequest.isError && <RequestErrorAlert request={verifyRequest} />}
          {repoName && <RepositoryHealth name={repoName} onHealthChange={onStatusChange} />}

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
              disabled={verifyRequest.isLoading}
              icon={verifyRequest.isLoading ? 'spinner' : 'check-circle'}
            >
              {verifyRequest.isLoading ? 'Verifying...' : 'Connect & verify'}
            </Button>
          </Stack>
        </Stack>
      </FieldSet>
    );
  }

  return null;
}
