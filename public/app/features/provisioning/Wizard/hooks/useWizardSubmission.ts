import { RefObject, useCallback, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { dataToSpec } from '../../utils/data';
import { getFormErrors } from '../../utils/getFormErrors';
import { GitHubAppStepRef } from '../GitHubAppStep';
import { Step } from '../Stepper';
import { StepStatusInfo, WizardFormData, WizardStep } from '../types';

export interface UseWizardSubmissionParams {
  activeStep: WizardStep;
  currentStepConfig: Step<WizardStep> | undefined;
  methods: UseFormReturn<WizardFormData>;
  submitData: (
    spec: RepositorySpec,
    token?: string
  ) => Promise<{ data?: { metadata?: { name?: string } }; error?: unknown }>;
  githubAppStepRef: RefObject<GitHubAppStepRef>;
  setStepStatusInfo: (info: StepStatusInfo) => void;
  onSuccess: () => void;
}

export interface UseWizardSubmissionReturn {
  isSubmitting: boolean;
  handleSubmit: () => Promise<void>;
}

export function useWizardSubmission({
  activeStep,
  currentStepConfig,
  methods,
  submitData,
  githubAppStepRef,
  setStepStatusInfo,
  onSuccess,
}: UseWizardSubmissionParams): UseWizardSubmissionReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setValue } = methods;

  const repositoryRequestFailed = t(
    'provisioning.provisioning-wizard.on-submit.title.repository-request-failed',
    'Repository request failed'
  );
  const repositoryConnectionFailed = t(
    'provisioning.provisioning-wizard.on-submit.title.repository-connection-failed',
    'Repository connection failed'
  );

  const handleSubmit = useCallback(async () => {
    const { getValues, trigger, setError } = methods;

    if (currentStepConfig?.submitOnNext) {
      if (activeStep === 'githubApp') {
        const formData = getValues();
        const currentGithubAppMode = formData.githubAppMode;

        if (currentGithubAppMode === 'existing') {
          const isValid = await trigger('githubApp.connectionName');
          if (isValid) {
            onSuccess();
          }
          return;
        } else if (currentGithubAppMode === 'new') {
          setIsSubmitting(true);
          try {
            await githubAppStepRef.current?.submit();
          } finally {
            setIsSubmitting(false);
          }
          return;
        }
      }

      const fieldsToValidate =
        activeStep === 'connection' ? (['repository'] as const) : (['repository', 'repository.title'] as const);

      const isValid = await trigger(fieldsToValidate);
      if (!isValid) {
        return;
      }

      setIsSubmitting(true);
      try {
        const formData = getValues();
        const connectionName =
          formData.githubAuthType === 'github-app' ? formData.githubApp?.connectionName : undefined;
        const spec = dataToSpec(formData.repository, connectionName);
        const token = formData.githubAuthType === 'pat' ? formData.repository.token : undefined;
        const rsp = await submitData(spec, token);
        if (rsp.error) {
          if (isFetchError(rsp.error)) {
            setStepStatusInfo({
              status: 'error',
              error: {
                title: repositoryRequestFailed,
                message: rsp.error.data.message,
              },
            });
          } else {
            setStepStatusInfo({
              status: 'error',
              error: repositoryRequestFailed,
            });
          }
          return;
        }

        const name = rsp.data?.metadata?.name;
        if (name) {
          setValue('repositoryName', name);
          setStepStatusInfo({ status: 'success' });
          onSuccess();
        } else {
          console.error('Saved repository without a name:', rsp);
        }
      } catch (error) {
        const formData = getValues();
        if (isFetchError(error)) {
          const [field, errorMessage] = getFormErrors(error.data.errors);
          if (field === 'repository.token' && activeStep === 'connection' && formData.githubAuthType !== 'pat') {
            setStepStatusInfo({
              status: 'error',
              error: {
                title: repositoryConnectionFailed,
                message: errorMessage?.message ?? '',
              },
            });
          } else if (field && errorMessage) {
            setError(field, errorMessage);
          } else {
            setStepStatusInfo({
              status: 'error',
              error: {
                title: repositoryConnectionFailed,
                message: error.data.message,
              },
            });
          }
        } else {
          setStepStatusInfo({
            status: 'error',
            error: repositoryConnectionFailed,
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (activeStep === 'authType') {
        const formData = getValues();
        if (formData.githubAuthType) {
          onSuccess();
        }
        return;
      }

      onSuccess();
    }
  }, [
    activeStep,
    currentStepConfig,
    methods,
    submitData,
    githubAppStepRef,
    setStepStatusInfo,
    onSuccess,
    repositoryRequestFailed,
    repositoryConnectionFailed,
    setValue,
  ]);

  return {
    isSubmitting,
    handleSubmit,
  };
}
