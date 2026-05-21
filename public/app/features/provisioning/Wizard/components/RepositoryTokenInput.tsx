import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Button, Field, Input, SecretInput, Stack, TextArea } from '@grafana/ui';

import { GPGSigningKeyInfo } from '../../Shared/GPGSigningKeyInfo';
import { TokenPermissionsInfo } from '../../Shared/TokenPermissionsInfo';
import { getHasTokenInstructions } from '../../utils/git';
import { isGitProvider } from '../../utils/repositoryTypes';
import { getGitProviderFields } from '../fields';
import { type WizardFormData } from '../types';

export function RepositoryTokenInput() {
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [signingKeyConfigured, setSigningKeyConfigured] = useState(false);
  const {
    register,
    control,
    setValue,
    formState: { errors },
    getValues,
    watch,
  } = useFormContext<WizardFormData>();
  const signingKeyValue = watch('repository.gpgSigningKey');
  const requireAuthor = Boolean(signingKeyValue);
  const authorRequiredMessage = t(
    'provisioning.wizard.commit-author-required',
    'Required when a GPG signing key is set so the commit matches the key UID'
  );

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

      {gitFields.gpgSigningKeyConfig && (
        <>
          {signingKeyConfigured ? (
            <Field
              noMargin
              label={t('provisioning.wizard.label-commit-signing', 'Commit signing')}
              description={t(
                'provisioning.wizard.description-commit-signing-configured',
                'A GPG signing key and committer identity are configured. Click reset to change them.'
              )}
            >
              <Stack gap={1} alignItems="center">
                <Input value={t('provisioning.wizard.signing-configured', 'configured')} disabled />
                <Button
                  variant="secondary"
                  fill="outline"
                  onClick={() => {
                    setValue('repository.gpgSigningKey', '');
                    setValue('repository.commit.authorName', '');
                    setValue('repository.commit.authorEmail', '');
                    setSigningKeyConfigured(false);
                  }}
                >
                  {t('provisioning.wizard.button-reset-signing', 'Reset')}
                </Button>
              </Stack>
            </Field>
          ) : (
            <>
              <Field
                noMargin
                label={gitFields.gpgSigningKeyConfig.label}
                description={gitFields.gpgSigningKeyConfig.description}
                error={errors?.repository?.gpgSigningKey?.message}
                invalid={!!errors?.repository?.gpgSigningKey?.message}
              >
                <TextArea
                  {...register('repository.gpgSigningKey')}
                  invalid={!!errors?.repository?.gpgSigningKey?.message}
                  id="gpgSigningKey"
                  placeholder={gitFields.gpgSigningKeyConfig.placeholder}
                  rows={8}
                />
              </Field>
              <Field
                noMargin
                required={requireAuthor}
                label={t('provisioning.wizard.label-commit-author-name', 'Commit author name')}
                description={t(
                  'provisioning.wizard.description-commit-author-name',
                  'Name attached to each commit. Should match the GPG signing key UID when commits are signed.'
                )}
                error={errors?.repository?.commit?.authorName?.message}
                invalid={!!errors?.repository?.commit?.authorName?.message}
              >
                <Input
                  id="repository-commit-author-name"
                  {...register('repository.commit.authorName', {
                    validate: (val) =>
                      !requireAuthor || (val?.trim() ?? '').length > 0 || authorRequiredMessage,
                  })}
                  placeholder={t('provisioning.wizard.placeholder-commit-author-name', 'Grafana')}
                />
              </Field>
              <Field
                noMargin
                required={requireAuthor}
                label={t('provisioning.wizard.label-commit-author-email', 'Commit author email')}
                description={t(
                  'provisioning.wizard.description-commit-author-email',
                  'Email attached to each commit. For GitHub "Verified" commits, must match the GPG signing key UID and a verified email on the GitHub account where the public key is registered.'
                )}
                error={errors?.repository?.commit?.authorEmail?.message}
                invalid={!!errors?.repository?.commit?.authorEmail?.message}
              >
                <Input
                  id="repository-commit-author-email"
                  type="email"
                  {...register('repository.commit.authorEmail', {
                    validate: (val) =>
                      !requireAuthor || (val?.trim() ?? '').length > 0 || authorRequiredMessage,
                  })}
                  placeholder={t('provisioning.wizard.placeholder-commit-author-email', 'noreply@grafana.com')}
                />
              </Field>
            </>
          )}
          {hasTokenInstructions && <GPGSigningKeyInfo type={type} />}
        </>
      )}
    </>
  );
}
