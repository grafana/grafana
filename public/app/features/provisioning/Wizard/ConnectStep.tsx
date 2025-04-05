import { useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Combobox, ComboboxOption, Field, Input, SecretInput, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { getWorkflowOptions } from '../Config/ConfigForm';
import { TokenPermissionsInfo } from '../Shared/TokenPermissionsInfo';

import { WizardFormData } from './types';

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

  const typeOptions = useMemo<Array<ComboboxOption<'github' | 'local'>>>(
    () => [
      { label: t('provisioning.connect-step.storage-type-github', 'GitHub'), value: 'github' },
      { label: t('provisioning.connect-step.storage-type-local', 'Local'), value: 'local' },
    ],
    []
  );

  const isGithub = type === 'github';

  return (
    <Stack direction="column">
      <Field
        label={t('provisioning.connect-step.label-storage-type', 'Storage type')}
        required
        description={t(
          'provisioning.connect-step.description-choose-storage-resources',
          'Choose the type of storage for your resources'
        )}
      >
        <Controller
          name={'repository.type'}
          render={({ field: { ref, onChange, ...field } }) => {
            return (
              <Combobox
                options={typeOptions}
                onChange={(value) => {
                  const repoType = value?.value;
                  onChange(repoType);
                  setValue(
                    'repository.workflows',
                    getWorkflowOptions(repoType).map((v) => v.value)
                  );
                }}
                {...field}
              />
            );
          }}
        />
      </Field>

      {isGithub && (
        <>
          <TokenPermissionsInfo />
          <Field
            label={t('provisioning.connect-step.label-access-token', 'Enter your access token')}
            required
            description={t(
              'provisioning.connect-step.description-paste-your-git-hub-personal-access-token',
              'Paste your GitHub personal access token'
            )}
            error={errors.repository?.token?.message}
            invalid={!!errors.repository?.token}
          >
            <Controller
              name={'repository.token'}
              control={control}
              rules={{ required: t('provisioning.connect-step.error-field-required', 'This field is required.') }}
              render={({ field: { ref, ...field } }) => {
                return (
                  <SecretInput
                    {...field}
                    id={'token'}
                    placeholder={t(
                      'provisioning.connect-step.placeholder-github-token',
                      'github_pat_yourTokenHere1234567890abcdEFGHijklMNOP'
                    )}
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
            label={t('provisioning.connect-step.label-repository-url', 'Enter your Repository URL')}
            error={errors.repository?.url?.message}
            invalid={!!errors.repository?.url}
            description={t(
              'provisioning.connect-step.description-repository-url',
              'Paste the URL of your GitHub repository'
            )}
            required
          >
            <Input
              {...register('repository.url', {
                required: t('provisioning.connect-step.error-field-required', 'This field is required.'),
                pattern: {
                  // TODO: The regex is not correct when we support GHES.
                  value: /^(?:https:\/\/github\.com\/)?[^/]+\/[^/]+$/,
                  message: t(
                    'provisioning.connect-step.error-invalid-github-url',
                    'Please enter a valid GitHub repository URL'
                  ),
                },
              })}
              placeholder={t('provisioning.connect-step.placeholder-github-url', 'https://github.com/username/repo')}
            />
          </Field>

          <Field
            label={t('provisioning.connect-step.label-branch', 'Branch')}
            error={errors.repository?.branch?.message}
            invalid={!!errors.repository?.branch}
          >
            <Input
              {...register('repository.branch')}
              placeholder={t('provisioning.connect-step.placeholder-branch', 'main')}
            />
          </Field>

          <Field
            label={t('provisioning.connect-step.label-path', 'Path')}
            error={errors.repository?.path?.message}
            invalid={!!errors.repository?.path}
            description={t(
              'provisioning.connect-step.description-github-path',
              'Path to a subdirectory in the Git repository'
            )}
          >
            <Input
              {...register('repository.path')}
              placeholder={t('provisioning.connect-step.placeholder-github-path', 'grafana/')}
            />
          </Field>
        </>
      )}

      {type === 'local' && (
        <Field
          label={t('provisioning.connect-step.label-local-path', 'Local path')}
          error={errors.repository?.path?.message}
          invalid={!!errors.repository?.path}
        >
          <Input
            {...register('repository.path', {
              required: t('provisioning.connect-step.error-field-required', 'This field is required.'),
            })}
            placeholder={t('provisioning.connect-step.placeholder-local-path', '/path/to/repo')}
          />
        </Field>
      )}
    </Stack>
  );
}
