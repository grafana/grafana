import { memo, useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Checkbox, Divider, Field, Input, SecretTextArea, Stack, Text, TextLink } from '@grafana/ui';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { EnablePushToConfiguredBranchOption } from '../Config/EnablePushToConfiguredBranchOption';
import { checkImageRenderer, checkImageRenderingAllowed, checkPublicAccess } from '../GettingStarted/features';
import { GPGSigningKeyInfo } from '../Shared/GPGSigningKeyInfo';
import { getHasTokenInstructions } from '../utils/git';
import { isGitProvider } from '../utils/repositoryTypes';

import { useStepStatus } from './StepStatusContext';
import { getCommitAuthorRequiredMessage, getGitProviderFields } from './fields';
import { type WizardFormData } from './types';

export const FinishStep = memo(function FinishStep() {
  const { setStepStatusInfo, hasStepError } = useStepStatus();
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WizardFormData>();
  const settings = useGetFrontendSettingsQuery();
  const [signingKeyConfigured, setSigningKeyConfigured] = useState(false);

  const [type, readOnly] = watch(['repository.type', 'repository.readOnly']);
  const signingKeyValue = watch('repository.gpgSigningKey');
  const requireAuthor = Boolean(signingKeyValue);
  const authorRequiredMessage = getCommitAuthorRequiredMessage();

  const isGithub = type === 'github';
  const isGitBased = isGitProvider(type);
  const isPublic = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();
  const imageRenderingAllowed = checkImageRenderingAllowed(settings.data);
  const hasTokenInstructions = getHasTokenInstructions(type);

  // Set sync enabled by default
  useEffect(() => {
    setValue('repository.sync.enabled', true);
  }, [setValue]);

  useEffect(() => {
    if (!hasStepError) {
      return;
    }
    const subscription = watch((_value, { name }) => {
      if (name) {
        setStepStatusInfo({ status: 'idle' });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, hasStepError, setStepStatusInfo]);

  // Get field configurations for git-based providers
  const gitFields = isGitBased ? getGitProviderFields(type) : null;

  return (
    <Stack direction="column" gap={2}>
      {isGitBased && (
        <Field
          noMargin
          label={t('provisioning.finish-step.label-sync-interval', 'Sync Interval (seconds)')}
          description={t(
            'provisioning.finish-step.description-sync-interval',
            'How often to sync changes from the repository'
          )}
          required
          error={errors?.repository?.sync?.intervalSeconds?.message}
          invalid={!!errors?.repository?.sync?.intervalSeconds?.message}
        >
          <Input
            {...register('repository.sync.intervalSeconds', {
              valueAsNumber: true,
              required: t('provisioning.finish-step.error-sync-interval-required', 'Sync interval is required'),
            })}
            type="number"
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="60"
          />
        </Field>
      )}

      <Field noMargin>
        <Checkbox
          {...register('repository.readOnly', {
            onChange: (e) => {
              if (e.target.checked) {
                setValue('repository.prWorkflow', false);
                setValue('repository.enablePushToConfiguredBranch', false);
              }
            },
          })}
          label={t('provisioning.finish-step.label-read-only', 'Read only')}
          description={t(
            'provisioning.finish-step.description-read-only',
            "Resources can't be modified through Grafana."
          )}
        />
      </Field>

      {gitFields && (
        <Field noMargin>
          <Checkbox
            {...register('repository.prWorkflow')}
            disabled={readOnly}
            label={gitFields.prWorkflowConfig.label}
            description={gitFields.prWorkflowConfig.description}
          />
        </Field>
      )}

      {isGitBased && (
        <EnablePushToConfiguredBranchOption<WizardFormData>
          register={register}
          readOnly={readOnly}
          registerName="repository.enablePushToConfiguredBranch"
        />
      )}

      {isGithub && imageRenderingAllowed && (
        <Field noMargin>
          <Checkbox
            {...register('repository.generateDashboardPreviews')}
            label={t('provisioning.finish-step.label-generate-dashboard-previews', 'Generate Dashboard Previews')}
            description={
              <>
                <Trans i18nKey="provisioning.finish-step.description-generate-dashboard-previews">
                  Create preview links for pull requests
                </Trans>
                {(!isPublic || !hasImageRenderer) && (
                  <>
                    {' '}
                    <Text color="secondary">
                      <Trans i18nKey="provisioning.finish-step.description-preview-requirements">
                        (requires{' '}
                        <TextLink href="https://grafana.com/docs/grafana/latest/setup-grafana/image-rendering/">
                          image rendering
                        </TextLink>{' '}
                        and public access enabled)
                      </Trans>
                    </Text>
                  </>
                )}
              </>
            }
            disabled={!isPublic || !hasImageRenderer}
          />
        </Field>
      )}

      {isGithub && (
        <Field
          noMargin
          label={t('provisioning.finish-step.label-webhook-url', 'Webhook URL')}
          description={t(
            'provisioning.finish-step.description-webhook-url',
            'Overrides the auto-detected URL for registering webhooks.'
          )}
        >
          <Input
            {...register('repository.webhook.baseUrl')}
            placeholder={t('provisioning.finish-step.placeholder-webhook-url', 'https://grafana.example.com')}
          />
        </Field>
      )}

      {gitFields?.gpgSigningKeyConfig && gitFields.commitAuthorNameConfig && gitFields.commitAuthorEmailConfig && (
        <>
          <Divider spacing={0} />
          {hasTokenInstructions && <GPGSigningKeyInfo type={type} />}
          <Field
            noMargin
            htmlFor="gpgSigningKey"
            label={gitFields.gpgSigningKeyConfig.label}
            description={gitFields.gpgSigningKeyConfig.description}
            error={errors?.repository?.gpgSigningKey?.message}
            invalid={!!errors?.repository?.gpgSigningKey}
          >
            <Controller
              name="repository.gpgSigningKey"
              control={control}
              render={({ field: { ref, ...field } }) => (
                <SecretTextArea
                  {...field}
                  id="gpgSigningKey"
                  invalid={!!errors?.repository?.gpgSigningKey}
                  placeholder={gitFields.gpgSigningKeyConfig?.placeholder}
                  isConfigured={signingKeyConfigured}
                  onReset={() => {
                    setValue('repository.gpgSigningKey', '');
                    setValue('repository.commit.authorName', '');
                    setValue('repository.commit.authorEmail', '');
                    setSigningKeyConfigured(false);
                  }}
                  rows={8}
                  grow
                />
              )}
            />
          </Field>
          <Field
            noMargin
            htmlFor="commit-author-name"
            required={requireAuthor}
            label={gitFields.commitAuthorNameConfig.label}
            description={gitFields.commitAuthorNameConfig.description}
            error={errors?.repository?.commit?.authorName?.message}
            invalid={!!errors?.repository?.commit?.authorName}
          >
            <Input
              id="commit-author-name"
              disabled={!signingKeyValue}
              {...register('repository.commit.authorName', {
                validate: (val) => !requireAuthor || (val?.trim() ?? '').length > 0 || authorRequiredMessage,
              })}
              placeholder={gitFields.commitAuthorNameConfig.placeholder}
            />
          </Field>
          <Field
            noMargin
            htmlFor="commit-author-email"
            required={requireAuthor}
            label={gitFields.commitAuthorEmailConfig.label}
            description={gitFields.commitAuthorEmailConfig.description}
            error={errors?.repository?.commit?.authorEmail?.message}
            invalid={!!errors?.repository?.commit?.authorEmail}
          >
            <Input
              id="commit-author-email"
              type="email"
              disabled={!signingKeyValue}
              {...register('repository.commit.authorEmail', {
                validate: (val) => !requireAuthor || (val?.trim() ?? '').length > 0 || authorRequiredMessage,
              })}
              placeholder={gitFields.commitAuthorEmailConfig.placeholder}
            />
          </Field>
        </>
      )}
    </Stack>
  );
});
