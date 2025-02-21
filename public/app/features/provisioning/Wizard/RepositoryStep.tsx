import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Field, FieldSet, Input, MultiCombobox, SecretInput, Stack, Switch, ControlledCollapse } from '@grafana/ui';

import { getWorkflowOptions } from '../ConfigForm';
import { TokenPermissionsInfo } from '../TokenPermissionsInfo';

import { RequestErrorAlert } from './RequestErrorAlert';
import { WizardFormData } from './types';

interface Props {
  request: {
    isError: boolean;
    error?: unknown;
  };
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

export function RepositoryStep({ request }: Props) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const type = watch('repository.type');
  const [tokenConfigured, setTokenConfigured] = useState(false);

  const WorkflowsField = () => (
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

  if (type === 'github') {
    return (
      <FieldSet label="2. Configure repository">
        <Stack direction="column" gap={1}>
          <RequestErrorAlert request={request} />
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

          <WorkflowsField />
          <AdvancedSettingsFields />
        </Stack>
      </FieldSet>
    );
  }

  if (type === 'local') {
    return (
      <FieldSet label="2. Configure repository">
        <Stack direction="column" gap={2}>
          <RequestErrorAlert request={request} />

          <Field label={'Local path'} error={errors.repository?.path?.message} invalid={!!errors.repository?.path}>
            <Input
              {...register('repository.path', { required: 'This field is required.' })}
              placeholder={'/path/to/repo'}
            />
          </Field>

          <WorkflowsField />
          <AdvancedSettingsFields />
        </Stack>
      </FieldSet>
    );
  }

  return null;
}
