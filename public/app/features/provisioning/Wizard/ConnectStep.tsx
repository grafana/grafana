import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Combobox, ComboboxOption, Field, Input, SecretInput, Stack } from '@grafana/ui';

import { getWorkflowOptions } from '../Config/ConfigForm';
import { TokenPermissionsInfo } from '../Shared/TokenPermissionsInfo';

import { WizardFormData } from './types';

const typeOptions: Array<ComboboxOption<'github' | 'local'>> = [
  { label: 'GitHub', value: 'github' },
  { label: 'Local', value: 'local' },
];

export function ConnectStep() {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const type = watch('repository.type');
  const [tokenConfigured, setTokenConfigured] = useState(false);

  const isGithub = type === 'github';

  return (
    <Stack direction="column">
      <Combobox
        options={typeOptions}
        value={type}
        onChange={(value) => {
          const repoType = value?.value;
          setValue('repository.type', repoType);
          setValue(
            'repository.workflows',
            getWorkflowOptions(repoType).map((v) => v.value)
          );
        }}
      />

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

          <Field
            label={'Path'}
            error={errors.repository?.path?.message}
            invalid={!!errors.repository?.path}
            description={'Path to a subdirectory in the Git repository'}
          >
            <Input {...register('repository.path')} placeholder={'grafana/'} />
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
    </Stack>
  );
}
