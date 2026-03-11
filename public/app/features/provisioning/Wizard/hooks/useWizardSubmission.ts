import { useCallback, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { dataToSpec } from '../../utils/data';
import { getFormErrors } from '../../utils/getFormErrors';
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
    const formData = getValues();

    if (currentStepConfig?.submitOnNext) {
      setStepStatusInfo({ status: 'idle' });
      const fieldsToValidate =
        activeStep === 'connection' || activeStep === 'authType'
          ? (['repository'] as const)
          : (['repository', 'repository.title'] as const);

      const isValid = await trigger(fieldsToValidate);

      if (!isValid) {
        return;
      }

      setIsSubmitting(true);
      try {
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
          setStepStatusInfo({
            status: 'error',
            error: {
              title: repositoryRequestFailed,
              message: t(
                'provisioning.provisioning-wizard.on-submit.error.no-repository-name',
                'Repository was saved but no name was returned'
              ),
            },
          });
        }
      } catch (error) {
        if (isFetchError(error)) {
          const errors = getFormErrors(error.data);
          // Check for special case: token error when using GitHub App
          const tokenError = errors.find(([field]) => field === 'repository.token');
          if (tokenError && activeStep === 'connection' && formData.githubAuthType !== 'pat') {
            const [, errorMessage] = tokenError;
            setStepStatusInfo({
              status: 'error',
              error: {
                title: repositoryConnectionFailed,
                message: errorMessage.message,
              },
            });
          } else if (errors.length > 0) {
            const visibleFields = currentStepConfig?.formFields;
            for (const [field, errorMessage] of errors) {
              if (!visibleFields || visibleFields.includes(field)) {
                setError(field, errorMessage);
              }
            }
            const combinedMessage = errors.map(([, err]) => err.message).join('\n');
            setStepStatusInfo({
              status: 'error',
              error: {
                title: repositoryConnectionFailed,
                message: combinedMessage,
              },
            });
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
