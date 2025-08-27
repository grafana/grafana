import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Combobox, Field, Input, SecretInput, Stack } from '@grafana/ui';

import { TokenPermissionsInfo } from '../Shared/TokenPermissionsInfo';
import { useBranchOptions } from '../hooks/useBranchOptions';
import { getHasTokenInstructions } from '../utils/git';
import { isGitProvider } from '../utils/repositoryTypes';

import { getGitProviderFields, getLocalProviderFields } from './fields';
import { WizardFormData } from './types';

export function ConnectStep() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
    getValues,
    watch,
  } = useFormContext<WizardFormData>();

  const [tokenConfigured, setTokenConfigured] = useState(false);

  // We don't need to dynamically react on repo type changes, so we use getValues for it
  const type = getValues('repository.type');
  const [repositoryUrl = '', repositoryToken = ''] = watch(['repository.url', 'repository.token']);
  const isGitBased = isGitProvider(type);

  const {
    options: branchOptions,
    loading: branchesLoading,
    error: branchesError,
  } = useBranchOptions({
    repositoryType: type,
    repositoryUrl,
    repositoryToken,
  });

  const gitFields = isGitBased ? getGitProviderFields(type) : null;
  const localFields = !isGitBased ? getLocalProviderFields(type) : null;
  const hasTokenInstructions = getHasTokenInstructions(type);

  return (
    <Stack direction="column" gap={2}>
      {hasTokenInstructions && <TokenPermissionsInfo type={type} />}

      {gitFields && (
        <>
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

          <Field
            noMargin
            label={gitFields.urlConfig.label}
            description={gitFields.urlConfig.description}
            error={errors?.repository?.url?.message}
            invalid={Boolean(errors?.repository?.url?.message)}
            required={gitFields.urlConfig.required}
          >
            <Input
              {...register('repository.url', gitFields.urlConfig.validation)}
              id="repository-url"
              placeholder={gitFields.urlConfig.placeholder}
            />
          </Field>

          <Field
            noMargin
            label={gitFields.branchConfig.label}
            description={gitFields.branchConfig.description}
            error={errors?.repository?.branch?.message}
            required={gitFields.branchConfig.required}
            invalid={Boolean(errors?.repository?.branch?.message || branchesError)}
          >
            <Controller
              name="repository.branch"
              control={control}
              rules={gitFields.branchConfig.validation}
              render={({ field: { ref, onChange, ...field } }) => (
                <Combobox
                  invalid={Boolean(errors?.repository?.branch?.message || branchesError)}
                  onChange={(option) => onChange(option?.value || '')}
                  placeholder={gitFields.branchConfig.placeholder}
                  options={branchOptions}
                  loading={branchesLoading}
                  createCustomValue
                  isClearable
                  {...field}
                />
              )}
            />
          </Field>

          <Field
            noMargin
            label={gitFields.pathConfig.label}
            description={gitFields.pathConfig.description}
            error={errors?.repository?.path?.message}
            invalid={!!errors?.repository?.path?.message}
            required={gitFields.pathConfig.required}
          >
            <Input
              {...register('repository.path', gitFields.pathConfig.validation)}
              id="git-path"
              placeholder={gitFields.pathConfig.placeholder}
            />
          </Field>
        </>
      )}

      {localFields && (
        <Field
          noMargin
          label={localFields.pathConfig.label}
          description={localFields.pathConfig.description}
          error={errors?.repository?.path?.message}
          invalid={!!errors?.repository?.path?.message}
          required={localFields.pathConfig.required}
        >
          <Input
            {...register('repository.path', localFields.pathConfig.validation)}
            id="local-path"
            placeholder={localFields.pathConfig.placeholder}
          />
        </Field>
      )}
    </Stack>
  );
}
