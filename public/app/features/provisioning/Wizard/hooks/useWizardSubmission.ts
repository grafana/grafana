import { RefObject, useCallback, useState } from 'react';
import { UseFormReturn, UseFormSetValue } from 'react-hook-form';

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
  setValue: UseFormSetValue<WizardFormData>;
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
  setValue,
}: UseWizardSubmissionParams): UseWizardSubmissionReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Special handling for GitHub App step
      if (activeStep === 'githubApp') {
        const formData = getValues();
        const currentGithubAppMode = formData.githubAppMode;

        // Validate based on mode
        if (currentGithubAppMode === 'existing') {
          const isValid = await trigger('githubApp.connectionName');
          if (isValid) {
            onSuccess();
          }
          return;
        } else if (currentGithubAppMode === 'new') {
          // Step handles validation and API call internally via submit()
          // The onSubmit callback will be called by GitHubAppStep with the result
          setIsSubmitting(true);
          try {
            await githubAppStepRef.current?.submit();
            // Note: onSubmit callback handles success/error, so we don't call onSuccess here
          } finally {
            setIsSubmitting(false);
          }
          return;
        }
      }

      // Validate form data before proceeding
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

        // Fill in the k8s name from the initial POST response
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
          // Special handling for token errors on connecting step with the app flow,
          // since we do not show the token field on that step
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
      // Special handling for authType step - validate selection and proceed
      if (activeStep === 'authType') {
        const formData = getValues();
        if (formData.githubAuthType) {
          onSuccess();
        }
        return;
      }

      // For other steps without submission, proceed if the job was successful or had warnings
      // This will be handled by the parent component checking step status
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
    setValue,
    repositoryRequestFailed,
    repositoryConnectionFailed,
  ]);

  return {
    isSubmitting,
    handleSubmit,
  };
}
