import { memo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Combobox, Field, Input, Stack } from '@grafana/ui';

import { FreeTierLimitNote } from '../Shared/FreeTierLimitNote';
import { useBranchOptions } from '../hooks/useBranchOptions';
import { useGetRepositoryRefs } from '../hooks/useGetRepositoryRefs';
import { isGitProvider } from '../utils/repositoryTypes';

import { RepositoryField } from './components/RepositoryField';
import { RepositoryTokenInput } from './components/RepositoryTokenInput';
import { getGitProviderFields, getLocalProviderFields } from './fields';
import { WizardFormData } from './types';

export const ConnectStep = memo(function ConnectStep() {
  const {
    register,
    control,
    formState: { errors },
    getValues,
    watch,
  } = useFormContext<WizardFormData>();

  // We don't need to dynamically react on repo type changes, so we use getValues for it
  const type = getValues('repository.type');
  const [repositoryUrl = '', repositoryToken = '', repositoryTokenUser = '', repositoryName = ''] = watch([
    'repository.url',
    'repository.token',
    'repository.tokenUser',
    'repositoryName',
  ]);
  const isGitBased = isGitProvider(type);
  const isGithubType = type === 'github';

  // this hook fetches branches directly from the git provider
  const {
    options: branchOptions,
    loading: branchesLoading,
    error: branchesError,
  } = useBranchOptions({
    repositoryType: type,
    repositoryUrl,
    repositoryToken,
    repositoryTokenUser,
  });

  // this hook returns branches from internal endpoint (only available for Github PAT and Github App)
  const {
    options: repositoryRefsOptions,
    loading: isRefsLoading,
    error: refsError,
  } = useGetRepositoryRefs({
    repositoryType: type,
    repositoryName: isGithubType ? repositoryName : undefined,
  });

  const branches = isGithubType ? repositoryRefsOptions : branchOptions;
  const isBranchesLoading = isGithubType ? isRefsLoading : branchesLoading;
  const branchesErrorMsg = isGithubType ? refsError : branchesError;
  const gitFields = isGitBased ? getGitProviderFields(type) : null;
  const localFields = !isGitBased ? getLocalProviderFields(type) : null;

  return (
    <Stack direction="column" gap={2}>
      {isGitBased && type !== 'github' && (
        <>
          <RepositoryTokenInput />
          <RepositoryField />
        </>
      )}

      {gitFields && (
        <>
          <Field
            noMargin
            label={gitFields.branchConfig.label}
            description={gitFields.branchConfig.description}
            error={errors?.repository?.branch?.message || branchesErrorMsg}
            required={gitFields.branchConfig.required}
            invalid={Boolean(errors?.repository?.branch?.message || branchesErrorMsg)}
          >
            <Controller
              name="repository.branch"
              control={control}
              rules={gitFields.branchConfig.validation}
              render={({ field: { ref, onChange, ...field } }) => (
                <Combobox
                  invalid={Boolean(errors?.repository?.branch?.message || branchesErrorMsg)}
                  onChange={(option) => onChange(option?.value || '')}
                  placeholder={gitFields.branchConfig.placeholder}
                  options={branches || []}
                  loading={isBranchesLoading}
                  disabled={isBranchesLoading}
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

      <FreeTierLimitNote limitType="connection" />
    </Stack>
  );
});
