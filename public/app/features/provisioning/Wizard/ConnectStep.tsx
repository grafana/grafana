import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Field, Input, SecretInput, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { TokenPermissionsInfo } from '../Shared/TokenPermissionsInfo';

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
  const isGithub = type === 'github';

  return (
    <Stack direction="column">
      {isGithub && (
        <>
          <TokenPermissionsInfo />
          <Field
            label={t('provisioning.connect-step.label-access-token', 'GitHub access token')}
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
            label={t('provisioning.connect-step.label-repository-url', 'GitHub repository URL')}
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
            label={t('provisioning.connect-step.label-branch', 'Branch name')}
            description={t('provisioning.connect-step.description-branch', 'Branch to use for the GitHub repository')}
            error={errors.repository?.branch?.message}
            invalid={!!errors.repository?.branch}
          >
            <Input
              {...register('repository.branch')}
              placeholder={t('provisioning.connect-step.placeholder-branch', 'main')}
            />
          </Field>

          <Field
            label={t('provisioning.connect-step.label-path', 'Path to subdirectory in repository')}
            error={errors.repository?.path?.message}
            invalid={!!errors.repository?.path}
            description={t(
              'provisioning.connect-step.description-github-path',
              'This is the path to a subdirectory in your GitHub repository where dashboards will be stored and provisioned from'
            )}
          >
            <Input {...register('repository.path')} />
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
