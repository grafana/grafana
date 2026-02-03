import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import {
  GetConnectionRepositoriesApiResponse,
  useGetConnectionRepositoriesQuery,
} from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
import { Combobox, Field, Input } from '@grafana/ui';

import { ExternalRepository } from '../../types';
import { isGitProvider } from '../../utils/repositoryTypes';
import { getGitProviderFields } from '../fields';
import { WizardFormData } from '../types';

type RepositoryWithRequiredFields = ExternalRepository & Required<Pick<ExternalRepository, 'name' | 'url'>>;

/**
 * @description Field component for selecting or entering a repository URL during onboarding flow
 * For GitHub App authentication, it fetches repositories associated with the selected connection
 * For PAT, it provides a text input
 */
export function RepositoryField({ isSelectedConnectionReady }: { isSelectedConnectionReady?: boolean }) {
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext<WizardFormData>();
  const [githubAuthType, githubAppConnectionName, type] = watch([
    'githubAuthType',
    'githubApp.connectionName',
    'repository.type',
  ]);

  const isGitBased = isGitProvider(type);
  const isGitHubAppAuth = type === 'github' && githubAuthType === 'github-app';
  const gitFields = isGitBased ? getGitProviderFields(type) : null;
  const {
    data: connectionRepositories,
    isLoading: repositoriesLoading,
    error: repositoriesError,
  } = useGetConnectionRepositoriesQuery(
    isGitHubAppAuth && githubAppConnectionName && isSelectedConnectionReady
      ? { name: githubAppConnectionName }
      : skipToken
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
      description={
        !isSelectedConnectionReady && isGitHubAppAuth
          ? t(
              'provisioning.wizard.connection-not-ready',
              'The selected GitHub App connection is not ready. List will be refreshed once the connection is ready.'
            )
          : gitFields.urlConfig.description
      }
      error={errors?.repository?.url?.message}
      invalid={Boolean(errors?.repository?.url?.message)}
      required={gitFields.urlConfig.required}
      htmlFor="repository-url"
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
                onChange={(option) => onChange(option?.value || '')}
                placeholder={gitFields.urlConfig.placeholder}
                options={repositoryOptions}
                loading={repositoriesLoading}
                disabled={!isSelectedConnectionReady || repositoriesLoading}
                createCustomValue
                isClearable
                {...field}
              />
            ) : (
              <Input {...field} id="repository-url" placeholder={gitFields.urlConfig.placeholder} onChange={onChange} />
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
    .filter((repo): repo is RepositoryWithRequiredFields => !!repo?.name && !!repo?.url)
    .map((repo) => {
      const label = repo.owner ? `${repo.owner}/${repo.name}` : repo.name;
      return { label, value: repo.url };
    });
}
