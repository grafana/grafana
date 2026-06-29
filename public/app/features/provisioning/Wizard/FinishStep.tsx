import { skipToken } from '@reduxjs/toolkit/query';
import { memo, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox, Field, Input, Stack } from '@grafana/ui';

import { BranchOptionsSection } from '../Config/BranchOptionsSection';
import { CommitOptionsSection } from '../Config/CommitOptionsSection';
import { EnablePushToConfiguredBranchOption } from '../Config/EnablePushToConfiguredBranchOption';
import { PullRequestOptionsSection } from '../Config/PullRequestOptionsSection';
import { WebhookSection } from '../Config/WebhookSection';
import { useConnectionList } from '../hooks/useConnectionList';
import { isGitProvider } from '../utils/repositoryTypes';

import { useStepStatus } from './StepStatusContext';
import { getGitProviderFields } from './fields';
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

  const [type, readOnly, wizardConnectionName, githubAuthType] = watch([
    'repository.type',
    'repository.readOnly',
    'githubApp.connectionName',
    'githubAuthType',
  ]);

  const isGithub = type === 'github';
  const isGitBased = isGitProvider(type);

  const [connections] = useConnectionList(isGithub && githubAuthType === 'github-app' ? {} : skipToken);
  const connectionWebhookDisabled = useMemo(() => {
    if (githubAuthType !== 'github-app' || !wizardConnectionName || !connections) {
      return false;
    }
    const conn = connections.find((c) => c.metadata?.name === wizardConnectionName);
    return Boolean(conn?.spec?.webhook?.disabled);
  }, [githubAuthType, wizardConnectionName, connections]);

  // Set sync enabled by default
  useEffect(() => {
    setValue('repository.sync.enabled', true);
  }, [setValue]);

  // Force webhook disabled when the selected connection requires it
  useEffect(() => {
    if (connectionWebhookDisabled) {
      setValue('repository.webhook.disabled', true);
    }
  }, [connectionWebhookDisabled, setValue]);

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
          <CommitOptionsSection<WizardFormData>
            register={register}
            control={control}
            setValue={setValue}
            messageTemplateName="repository.commit.singleResourceMessageTemplate"
            enforceTemplateName="repository.commit.enforceTemplate"
            type={type}
            signingMethodName="repository.signingMethod"
            signingKeyName="repository.commitSigningKey"
            smimeCertificateName="repository.smimeCertificate"
            signerNameName="repository.commit.signerName"
            signerEmailName="repository.commit.signerEmail"
          />
          {/* Pull requests are not supported by the pure git type. */}
          {type !== 'git' && (
            <PullRequestOptionsSection<WizardFormData>
              register={register}
              titleTemplateName="repository.pullRequest.titleTemplate"
              enforceTemplateName="repository.pullRequest.enforceTemplate"
              repoType={type}
              dashboardPreviewName="repository.generateDashboardPreviews"
            />
          )}
        </>
      )}

      {isGithub && (
        <WebhookSection<WizardFormData>
          register={register}
          control={control}
          name="repository.webhook.baseUrl"
          disabledName="repository.webhook.disabled"
          connectionWebhookDisabled={connectionWebhookDisabled}
          disabledError={errors?.repository?.webhook?.disabled?.message}
        />
      )}
    </Stack>
  );
});
