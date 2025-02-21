import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import {
  ControlledCollapse,
  Field,
  FieldSet,
  Input,
  MultiCombobox,
  RadioButtonGroup,
  SecretInput,
  Switch,
} from '@grafana/ui';

import { getWorkflowOptions } from '../ConfigForm';
import { TokenPermissionsInfo } from '../TokenPermissionsInfo';

import { WizardFormData } from './types';

const targetOptions = [
  { value: 'instance', label: 'Entire instance' },
  { value: 'folder', label: 'Managed folder' },
];

export function RepositoryStep() {
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

  const AdvancedFields = () => (
    <ControlledCollapse label="Advanced" isOpen={false}>
      <Field label={'Enabled'} description={'Once sync is enabled, the target cannot be changed.'}>
        <Switch {...register('repository.sync.enabled')} id={'repository.sync.enabled'} defaultChecked={true} />
      </Field>
      <Field
        label={'Target'}
        required
        error={errors?.repository?.sync?.target?.message}
        invalid={!!errors?.repository?.sync?.target}
      >
        <Controller
          name={'repository.sync.target'}
          control={control}
          rules={{ required: 'This field is required.' }}
          render={({ field: { ref, onChange, ...field } }) => {
            return <RadioButtonGroup options={targetOptions} onChange={onChange} {...field} />;
          }}
        />
      </Field>
      <Field label={'Interval (seconds)'}>
        <Input
          {...register('repository.sync.intervalSeconds', { valueAsNumber: true })}
          type={'number'}
          placeholder={'60'}
        />
      </Field>
    </ControlledCollapse>
  );

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

          <Field label={'Show dashboard previews'}>
            <Switch {...register('repository.generateDashboardPreviews')} />
          </Field>

          <WorkflowsField />
          <AdvancedFields />
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

        <WorkflowsField />
        <AdvancedFields />
      </FieldSet>
    );
  }

  return null;
}
