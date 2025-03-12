import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Combobox, Field, Input, SecretInput, Stack } from '@grafana/ui';

import { TokenPermissionsInfo } from '../TokenPermissionsInfo';

import { WizardFormData } from './types';

const typeOptions = [
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
          setValue('repository.type', value?.value as 'github' | 'local');
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

          <Field label={'Prefix'} error={errors.repository?.prefix?.message} invalid={!!errors.repository?.prefix}>
            <Input {...register('repository.prefix')} placeholder={'grafana/'} />
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
