import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import {
  GetConnectionRepositoriesApiResponse,
  useGetConnectionRepositoriesQuery,
} from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { Combobox, Field, Input } from '@grafana/ui';

import { isGitProvider } from '../../utils/repositoryTypes';
import { getGitProviderFields } from '../fields';
import { WizardFormData } from '../types';

export function RepositoriesList() {
  const {
    control,
    formState: { errors },
    getValues,
    watch,
  } = useFormContext<WizardFormData>();
  // We don't need to dynamically react on repo type changes, so we use getValues for it
  const type = getValues('repository.type');
  const [githubAuthType, githubAppConnectionName, url] = watch([
    'githubAuthType',
    'githubApp.connectionName',
    'repository.url',
  ]);
  const isGitBased = isGitProvider(type);
  const isGitHubAppAuth = type === 'github' && githubAuthType === 'github-app';
  const gitFields = isGitBased ? getGitProviderFields(type) : null;
  const {
    data: connectionRepositories,
    isLoading: repositoriesLoading,
    error: repositoriesError,
  } = useGetConnectionRepositoriesQuery(
    isGitHubAppAuth && githubAppConnectionName ? { name: githubAppConnectionName } : skipToken
  );

  const repositoryOptions = useMemo(() => {
    return buildRepositoryOptions(connectionRepositories?.items);
  }, [connectionRepositories]);

  if (!gitFields || (isGitHubAppAuth && !githubAppConnectionName)) {
    return null;
  }

  return (
    <Field
      noMargin
      label={gitFields.urlConfig.label}
      description={gitFields.urlConfig.description}
      error={errors?.repository?.url?.message}
      invalid={Boolean(errors?.repository?.url?.message)}
      required={gitFields.urlConfig.required}
    >
      <Controller
        name="repository.url"
        control={control}
        rules={gitFields.urlConfig.validation}
        render={({ field: { ref, onChange, ...field } }) => (
          <>
            {isGitHubAppAuth ? (
              <Combobox
                invalid={Boolean(errors?.repository?.url?.message || repositoriesError)}
                onChange={(option) => {
                  onChange(option?.value || '');
                  console.log('selected repo url', option);
                }}
                placeholder={gitFields.urlConfig.placeholder}
                options={repositoryOptions}
                loading={repositoriesLoading}
                createCustomValue
                isClearable
                {...field}
              />
            ) : (
              <Input id="repository-url" placeholder={gitFields.urlConfig.placeholder} onChange={onChange} />
            )}
          </>
        )}
      />
    </Field>
  );
}

function buildRepositoryOptions(
  repositories: GetConnectionRepositoriesApiResponse['items'] | undefined
): Array<{ label: string; value: string }> {
  return (repositories ?? [])
    .filter((repo): repo is { name: string; url: string } => !!repo?.name && !!repo?.url)
    .map((repo) => ({ label: repo.name, value: repo.url }));
}
