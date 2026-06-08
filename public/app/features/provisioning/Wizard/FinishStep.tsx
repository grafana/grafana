import { memo, useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import {
  Checkbox,
  ControlledCollapse,
  Field,
  Input,
  RadioButtonGroup,
  SecretTextArea,
  Stack,
  Text,
  TextArea,
  TextLink,
} from '@grafana/ui';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { BranchOptionsSection } from '../Config/BranchOptionsSection';
import { EnablePushToConfiguredBranchOption } from '../Config/EnablePushToConfiguredBranchOption';
import { checkImageRenderer, checkImageRenderingAllowed, checkPublicAccess } from '../GettingStarted/features';
import { GPGSigningKeyInfo } from '../Shared/GPGSigningKeyInfo';
import { getHasTokenInstructions } from '../utils/git';
import { isGitProvider } from '../utils/repositoryTypes';

import { useStepStatus } from './StepStatusContext';
import {
  getCommitAuthorRequiredMessage,
  getGitProviderFields,
  getSigningFormatOptions,
  getSigningKeyPlaceholder,
} from './fields';
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
  const signingKeyValue = watch('repository.signingKey');
  const signingFormat = watch('repository.signingFormat') ?? 'none';
  const signingEnabled = signingFormat !== 'none';
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

      {isGitBased && (
        <>
          <BranchOptionsSection<WizardFormData>
            register={register}
            nameTemplateName="repository.branchOptions.nameTemplate"
            enforceTemplateName="repository.branchOptions.enforceTemplate"
          />
          <ControlledCollapse
            label={t('provisioning.commit-options.label-commit-options', 'Commit options (advanced)')}
            isOpen={false}
          >
            <Stack direction="column" gap={2}>
              <Field
                noMargin
                label={t('provisioning.config-form.label-commit-message-template', 'Commit message template')}
                description={t(
                  'provisioning.config-form.description-commit-message-template',
                  'Default commit message when saving a provisioned resource. Available placeholders: {{actionVar}} (create/update/delete/move/rename), {{kindVar}} (dashboard/folder), {{idVar}}, {{titleVar}}, {{userNameVar}}, {{userLoginVar}}, {{userEmailVar}}. A "Grafana-saved-by: <name> (<login>)" trailer is appended automatically. Leave empty to use the built-in defaults.',
                  {
                    actionVar: '{{action}}',
                    kindVar: '{{resourceKind}}',
                    idVar: '{{resourceID}}',
                    titleVar: '{{title}}',
                    userNameVar: '{{userName}}',
                    userLoginVar: '{{userLogin}}',
                    userEmailVar: '{{userEmail}}',
                  }
                )}
              >
                <Input
                  id="commit-message-template"
                  {...register('repository.commit.singleResourceMessageTemplate')}
                  placeholder={t(
                    'provisioning.config-form.placeholder-commit-message-template',
                    'feat(dashboards): {{actionVar}} {{titleVar}}',
                    { actionVar: '{{action}}', titleVar: '{{title}}' }
                  )}
                />
              </Field>
              <Field noMargin>
                <Checkbox
                  {...register('repository.commit.enforceTemplate')}
                  label={t('provisioning.commit-options.label-enforce-template', 'Enforce commit message template')}
                  description={t(
                    'provisioning.commit-options.description-enforce-template',
                    'Pre-fill the commit message in save dialogs from the template above and make it read-only. The "Grafana-saved-by" trailer is always appended.'
                  )}
                />
              </Field>
              {gitFields?.signingFormatConfig && (
                <Field
                  noMargin
                  label={gitFields.signingFormatConfig.label}
                  description={gitFields.signingFormatConfig.description}
                >
                  <Controller
                    name="repository.signingFormat"
                    control={control}
                    render={({ field: { ref, ...field } }) => (
                      <RadioButtonGroup
                        {...field}
                        options={getSigningFormatOptions()}
                        onChange={(value) => {
                          field.onChange(value);
                          setValue('repository.signingKey', '');
                          setValue('repository.smimeCertificate', '');
                          setSigningKeyConfigured(false);
                        }}
                      />
                    )}
                  />
                </Field>
              )}
              {signingEnabled && gitFields?.signingKeyConfig && (
                <>
                  {hasTokenInstructions && <GPGSigningKeyInfo type={type} />}
                  <Field
                    noMargin
                    htmlFor="signingKey"
                    label={gitFields.signingKeyConfig.label}
                    description={gitFields.signingKeyConfig.description}
                    error={errors?.repository?.signingKey?.message}
                    invalid={!!errors?.repository?.signingKey}
                  >
                    <Controller
                      name="repository.signingKey"
                      control={control}
                      render={({ field: { ref, ...field } }) => (
                        <SecretTextArea
                          {...field}
                          id="signingKey"
                          invalid={!!errors?.repository?.signingKey}
                          placeholder={getSigningKeyPlaceholder(signingFormat)}
                          isConfigured={signingKeyConfigured}
                          onReset={() => {
                            setValue('repository.signingKey', '');
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
                  {signingFormat === 'smime' && gitFields.smimeCertificateConfig && (
                    <Field
                      noMargin
                      htmlFor="smimeCertificate"
                      label={gitFields.smimeCertificateConfig.label}
                      description={gitFields.smimeCertificateConfig.description}
                      error={errors?.repository?.smimeCertificate?.message}
                      invalid={!!errors?.repository?.smimeCertificate}
                    >
                      <Controller
                        name="repository.smimeCertificate"
                        control={control}
                        render={({ field: { ref, ...field } }) => (
                          <TextArea
                            {...field}
                            id="smimeCertificate"
                            invalid={!!errors?.repository?.smimeCertificate}
                            placeholder={gitFields.smimeCertificateConfig?.placeholder}
                            rows={8}
                          />
                        )}
                      />
                    </Field>
                  )}
                  {gitFields.commitAuthorNameConfig && (
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
                  )}
                  {gitFields.commitAuthorEmailConfig && (
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
                  )}
                </>
              )}
            </Stack>
          </ControlledCollapse>
        </>
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
    </Stack>
  );
});
