import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Field, Input, SecretInput, Stack } from '@grafana/ui';

import { TokenPermissionsInfo } from '../Shared/TokenPermissionsInfo';

import { getProviderFields } from './fields';
import { WizardFormData } from './types';

export function ConnectStep() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
    getValues,
  } = useFormContext<WizardFormData>();

  const [tokenConfigured, setTokenConfigured] = useState(false);

  const type = getValues('repository.type');
  const isGitBased = type !== 'local';
  const getFieldConfig = getProviderFields(type);

  // Get all field configs at once
  const { tokenConfig, urlConfig, branchConfig, pathConfig } = getFieldConfig(['token', 'url', 'branch', 'path']);

  return (
    <Stack direction="column" gap={2}>
      {type === 'github' && <TokenPermissionsInfo />}

      {isGitBased && tokenConfig && (
        <Field
          noMargin
          label={tokenConfig.label}
          required={tokenConfig.required}
          description={tokenConfig.description}
          error={errors?.repository?.token?.message}
          invalid={!!errors?.repository?.token?.message}
        >
          <Controller
            name="repository.token"
            control={control}
            rules={tokenConfig.validation}
            render={({ field: { ref, ...field } }) => (
              <SecretInput
                {...field}
                id="token"
                placeholder={tokenConfig.placeholder}
                isConfigured={tokenConfigured}
                onReset={() => {
                  setValue('repository.token', '');
                  setTokenConfigured(false);
                }}
              />
            )}
          />
        </Field>
      )}

      {isGitBased && urlConfig && (
        <Field
          noMargin
          label={urlConfig.label}
          description={urlConfig.description}
          error={errors?.repository?.url?.message}
          invalid={!!errors?.repository?.url?.message}
          required={urlConfig.required}
        >
          <Input {...register('repository.url', urlConfig.validation)} id="url" placeholder={urlConfig.placeholder} />
        </Field>
      )}

      {isGitBased && branchConfig && (
        <Field
          noMargin
          label={branchConfig.label}
          description={branchConfig.description}
          error={errors?.repository?.branch?.message}
          invalid={!!errors?.repository?.branch?.message}
          required={branchConfig.required}
        >
          <Input
            {...register('repository.branch', branchConfig.validation)}
            id="branch"
            placeholder={branchConfig.placeholder}
          />
        </Field>
      )}

      {pathConfig && (
        <Field
          noMargin
          label={pathConfig.label}
          description={pathConfig.description}
          error={errors?.repository?.path?.message}
          invalid={!!errors?.repository?.path?.message}
          required={pathConfig.required}
        >
          <Input
            {...register('repository.path', pathConfig.validation)}
            id="path"
            placeholder={pathConfig.placeholder}
          />
        </Field>
      )}
    </Stack>
  );
}
