import { memo, useEffect, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Combobox, Field, Input, Stack } from '@grafana/ui';

import { FreeTierLimitNote } from '../Shared/FreeTierLimitNote';
import { useGetRepositoryRefs } from '../hooks/useGetRepositoryRefs';
import { isGitProvider } from '../utils/repositoryTypes';

import { getGitProviderFields, getLocalProviderFields } from './fields';
import { WizardFormData } from './types';

export const ConnectStep = memo(function ConnectStep() {
  const {
    register,
    control,
    formState: { errors },
    getValues,
    watch,
    setValue,
  } = useFormContext<WizardFormData>();

  // We don't need to dynamically react on repo type changes, so we use getValues for it
  const type = getValues('repository.type');
  const [repositoryName = ''] = watch(['repositoryName']);
  const isGitBased = isGitProvider(type);

  const {
    options: repositoryRefsOptions,
    loading: isRefsLoading,
    error: refsError,
  } = useGetRepositoryRefs({
    repositoryType: type,
    repositoryName: repositoryName,
  });

  const gitFields = isGitBased ? getGitProviderFields(type) : null;
  const localFields = !isGitBased ? getLocalProviderFields(type) : null;

  // Track if we've already auto-selected a branch
  const hasAutoSelectedRef = useRef(false);

  // Auto-select branch when refs are loaded for the first time
  useEffect(() => {
    // Only auto-select if:
    // 1. We haven't already auto-selected
    // 2. We have branch options
    // 3. No branch is currently selected
    // 4. Not loading
    if (
      hasAutoSelectedRef.current ||
      !repositoryRefsOptions ||
      repositoryRefsOptions.length === 0 ||
      isRefsLoading ||
      getValues('repository.branch')
    ) {
      return;
    }

    // Get all branch names
    const branchNames = repositoryRefsOptions.map((opt) => opt.value);

    // Priority: main > master > first alphabetically
    let selectedBranch: string | undefined;
    if (branchNames.includes('main')) {
      selectedBranch = 'main';
    } else if (branchNames.includes('master')) {
      selectedBranch = 'master';
    } else {
      // Sort alphabetically and take the first
      selectedBranch = [...branchNames].sort()[0];
    }

    if (selectedBranch) {
      setValue('repository.branch', selectedBranch);
      hasAutoSelectedRef.current = true;
    }
  }, [repositoryRefsOptions, isRefsLoading, getValues, setValue]);

  return (
    <Stack direction="column" gap={2}>
      {gitFields && (
        <>
          <Field
            noMargin
            label={gitFields.branchConfig.label}
            description={gitFields.branchConfig.description}
            error={errors?.repository?.branch?.message || refsError}
            required={gitFields.branchConfig.required}
            invalid={Boolean(errors?.repository?.branch?.message || refsError)}
          >
            <Controller
              name="repository.branch"
              control={control}
              rules={gitFields.branchConfig.validation}
              render={({ field: { ref, onChange, ...field } }) => (
                <Combobox
                  invalid={Boolean(errors?.repository?.branch?.message || refsError)}
                  onChange={(option) => onChange(option?.value || '')}
                  placeholder={gitFields.branchConfig.placeholder}
                  options={repositoryRefsOptions || []}
                  loading={isRefsLoading}
                  disabled={isRefsLoading}
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
