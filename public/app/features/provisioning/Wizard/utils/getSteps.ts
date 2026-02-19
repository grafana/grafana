import { t } from '@grafana/i18n';

import { Step } from '../Stepper';
import { RepoType, StepStatusInfo, WizardStep } from '../types';

export const getSteps = (type: RepoType): Array<Step<WizardStep>> => {
  const isLocal = type === 'local';
  const authStepText = isLocal
    ? t('provisioning.wizard.connect-step-local', 'File provisioning')
    : t('provisioning.wizard.connect-step', 'Connect');
  return [
    {
      id: 'authType',
      name: authStepText,
      title: authStepText,
      submitOnNext: true,
    },
    {
      id: 'connection',
      name: isLocal
        ? t('provisioning.wizard.step-connect', 'Connect')
        : t('provisioning.wizard.step-configure-repo', 'Configure repository'),
      title: isLocal
        ? t('provisioning.wizard.title-connect', 'Connect to external storage')
        : t('provisioning.wizard.title-configure-repo', 'Configure repository'),
      submitOnNext: true,
    },
    {
      id: 'bootstrap',
      name: t('provisioning.wizard.step-bootstrap', 'Choose what to synchronize'),
      title: t('provisioning.wizard.title-bootstrap', 'Choose what to synchronize'),
      submitOnNext: true,
    },
    {
      id: 'synchronize',
      name: t('provisioning.wizard.step-synchronize', 'Synchronize with external storage'),
      title: t('provisioning.wizard.title-synchronize', 'Synchronize with external storage'),
      submitOnNext: false,
    },
    {
      id: 'finish',
      name: t('provisioning.wizard.step-finish', 'Choose additional settings'),
      title: t('provisioning.wizard.title-finish', 'Choose additional settings'),
      submitOnNext: true,
    },
  ];
};

interface SyncStepState {
  hasFieldErrors: boolean;
  hasError: boolean;
  isUnhealthy: boolean;
  isLoading: boolean;
  healthStatusNotReady: boolean;
  repositoryHealthMessages: string[] | undefined;
  goToStep: (stepId: WizardStep) => void;
}

export function getSyncStepStatus(state: SyncStepState): StepStatusInfo {
  if (state.isLoading || state.healthStatusNotReady) {
    return { status: 'running' };
  }

  if (state.hasError) {
    return {
      status: 'error',
      error: {
        title: t('provisioning.synchronize-step.repository-error', 'Repository error'),
        message: t(
          'provisioning.synchronize-step.repository-error-message',
          'Unable to check repository status. Please verify the repository configuration and try again.'
        ),
      },
    };
  }

  if (state.isUnhealthy && state.hasFieldErrors) {
    return {
      status: 'error',
      error: {
        title: t('provisioning.synchronize-step.field-errors', 'Configuration errors detected'),
        message: t(
          'provisioning.synchronize-step.field-errors-message',
          'There are issues with the repository configuration. Please review your settings.'
        ),
      },
      action: {
        label: t('provisioning.synchronize-step.review-configuration', 'Review configuration'),
        onClick: () => state.goToStep('connection'),
      },
    };
  }

  if (state.isUnhealthy) {
    return {
      status: 'error',
      error: {
        title: t('provisioning.synchronize-step.repository-unhealthy', 'The repository cannot be synchronized'),
        message: state.repositoryHealthMessages ?? [],
      },
    };
  }

  return { status: 'idle' };
}
