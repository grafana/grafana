import { memo, useEffect, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Combobox, Field, Input, Stack } from '@grafana/ui';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { QuotaLimitNote } from '../Shared/QuotaLimitNote';
import { useGetRepositoryFolders } from '../hooks/useGetRepositoryFolders';
import { useGetRepositoryRefs } from '../hooks/useGetRepositoryRefs';
import { isGitProvider } from '../utils/repositoryTypes';

import { getGitProviderFields, getLocalProviderFields } from './fields';
import { type WizardFormData } from './types';

export const ConnectStep = memo(function ConnectStep() {
  const {
    register,
    control,
    formState: { errors },
    getValues,
    watch,
    setValue,
  } = useFormContext<WizardFormData>();

  const { data: frontendSettings } = useGetFrontendSettingsQuery();
  // We don't need to dynamically react on repo type changes, so we use getValues for it
  const type = getValues('repository.type');
  const [repositoryName = '', branch = ''] = watch(['repositoryName', 'repository.branch']);
  const isGitBased = isGitProvider(type);

  const {
    options: repositoryRefsOptions,
    loading: isRefsLoading,
    error: refsError,
    defaultBranch,
  } = useGetRepositoryRefs({
    repositoryType: type,
    repositoryName: repositoryName,
  });

  const {
    options: folderOptions,
    loading: isFoldersLoading,
    error: foldersError,
    hint: foldersHint,
  } = useGetRepositoryFolders({
    repositoryName: repositoryName || undefined,
    ref: branch || undefined,
  });

  const gitFields = isGitBased ? getGitProviderFields(type) : null;
  const localFields = !isGitBased ? getLocalProviderFields(type) : null;

  const hasAutoSelectedRef = useRef(false);

  useEffect(() => {
    if (!hasAutoSelectedRef.current && defaultBranch && !getValues('repository.branch')) {
      setValue('repository.branch', defaultBranch);
      hasAutoSelectedRef.current = true;
    }
  }, [defaultBranch, getValues, setValue]);

  // Capture-phase mousedown so the typed path is committed to form state before
  // Combobox's blur sequence wipes it (e.g. clicking the wizard submit button
  // without first pressing Enter on the typed value).
  useEffect(() => {
    const commitTypedPath = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.id === 'repository.path' && active.value) {
        setValue('repository.path', active.value, { shouldDirty: true });
      }
    };
    document.addEventListener('mousedown', commitTypedPath, { capture: true });
    return () => document.removeEventListener('mousedown', commitTypedPath, { capture: true });
  }, [setValue]);

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
            description={foldersHint || gitFields.pathConfig.description}
            error={errors?.repository?.path?.message || foldersError}
            invalid={Boolean(errors?.repository?.path?.message || foldersError)}
            required={gitFields.pathConfig.required}
          >
            <Controller
              name="repository.path"
              control={control}
              rules={gitFields.pathConfig.validation}
              render={({ field: { ref, onChange, ...field } }) => (
                <Combobox
                  id="repository.path"
                  invalid={!!errors?.repository?.path?.message}
                  onChange={(option) => onChange(option?.value || '')}
                  placeholder={gitFields.pathConfig.placeholder}
                  options={folderOptions}
                  loading={isFoldersLoading}
                  createCustomValue
                  isClearable
                  {...field}
                />
              )}
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

      <QuotaLimitNote maxRepositories={frontendSettings?.maxRepositories} />
    </Stack>
  );
});
