import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Field, Input, SecretInput } from '@grafana/ui';

import { TokenPermissionsInfo } from '../../Shared/TokenPermissionsInfo';
import { getHasTokenInstructions } from '../../utils/git';
import { isGitProvider } from '../../utils/repositoryTypes';
import { getGitProviderFields } from '../fields';
import { WizardFormData } from '../types';

export function RepositoryTokenInput() {
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const {
    register,
    control,
    setValue,
    formState: { errors },
    getValues,
  } = useFormContext<WizardFormData>();

  const type = getValues('repository.type');
  const isGitBased = isGitProvider(type);
  const gitFields = isGitBased ? getGitProviderFields(type) : null;
  const hasTokenInstructions = getHasTokenInstructions(type);

  if (!gitFields) {
    return null;
  }

  return (
    <>
      {hasTokenInstructions && <TokenPermissionsInfo type={type} />}
      <Field
        noMargin
        label={gitFields.tokenConfig.label}
        required={gitFields.tokenConfig.required}
        description={gitFields.tokenConfig.description}
        error={errors?.repository?.token?.message}
        invalid={!!errors?.repository?.token?.message}
      >
        <Controller
          name="repository.token"
          control={control}
          rules={gitFields.tokenConfig.validation}
          render={({ field: { ref, ...field } }) => (
            <SecretInput
              {...field}
              id="token"
              placeholder={gitFields.tokenConfig.placeholder}
              isConfigured={tokenConfigured}
              invalid={!!errors?.repository?.token?.message}
              onReset={() => {
                setValue('repository.token', '');
                setTokenConfigured(false);
              }}
            />
          )}
        />
      </Field>

      {gitFields.tokenUserConfig && (
        <Field
          noMargin
          label={gitFields.tokenUserConfig.label}
          required={gitFields.tokenUserConfig.required}
          description={gitFields.tokenUserConfig.description}
          error={errors?.repository?.tokenUser?.message}
          invalid={!!errors?.repository?.tokenUser?.message}
        >
          <Input
            {...register('repository.tokenUser', gitFields.tokenUserConfig.validation)}
            id="tokenUser"
            placeholder={gitFields.tokenUserConfig.placeholder}
          />
        </Field>
      )}
    </>
  );
}
