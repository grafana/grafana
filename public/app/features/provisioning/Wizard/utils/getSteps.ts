import { ErrorDetails } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';

import { getFormErrors } from '../../utils/getFormErrors';
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
  /** Repo field errors from the repository status */
  fieldErrors: ErrorDetails[] | undefined;
  /** Whether the repository status query has an error */
  hasError: boolean;
  /** Whether the repository is unhealthy */
  isUnhealthy: boolean;
  isLoading: boolean;
  healthStatusNotReady: boolean;
  /** Health messages from the repository status endpoint */
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

  if (state.isUnhealthy && state.fieldErrors?.length) {
    // Get the earliest step with field errors to navigate user to
    const targetStep = getEarliestErrorStep(state.fieldErrors);
    // When health is unhealthy and has field errors, show the field errors
    const fieldMessages = state.fieldErrors.filter((e) => e.detail).map((e) => e.detail!);

    return {
      status: 'error',
      error: {
        title: t('provisioning.synchronize-step.field-errors', 'Configuration errors detected'),
        message: fieldMessages.length
          ? fieldMessages
          : [
              t(
                'provisioning.synchronize-step.field-errors-message',
                'There are issues with the repository configuration. Please review your settings.'
              ),
            ],
      },
      action: {
        label: t('provisioning.synchronize-step.review-configuration', 'Review configuration'),
        onClick: () => state.goToStep(targetStep),
      },
    };
  }

  if (state.isUnhealthy) {
    // When health is unhealthy and has no field errors, show the health messages
    return {
      status: 'error',
      error: {
        title: t(
          'provisioning.synchronize-step.repository-unhealthy',
          'The repository cannot be synchronized. Cancel provisioning and try again once the issue has been resolved. See details below.'
        ),
        message: state.repositoryHealthMessages ?? '',
      },
    };
  }

  return { status: 'idle' };
}

// Map field to step for form errors
const FIELD_TO_STEP: Record<string, WizardStep> = {
  'repository.token': 'authType',
  'repository.tokenUser': 'authType',
  'repository.url': 'authType',
  'repository.branch': 'connection',
  'repository.path': 'connection',
  'repository.title': 'bootstrap',
  'repository.sync.target': 'bootstrap',
  'repository.sync.intervalSeconds': 'bootstrap',
};

const STEP_ORDER: WizardStep[] = ['authType', 'connection', 'bootstrap', 'synchronize', 'finish'];

export function getEarliestErrorStep(fieldErrors: ErrorDetails[]): WizardStep {
  const formErrors = getFormErrors(fieldErrors);

  let earliestIndex = STEP_ORDER.length;
  for (const [formPath] of formErrors) {
    const step = FIELD_TO_STEP[formPath];
    if (step) {
      const idx = STEP_ORDER.indexOf(step);
      if (idx < earliestIndex) {
        earliestIndex = idx;
      }
    }
  }

  // Default to 'authType' (first step) if no mapping found
  return earliestIndex < STEP_ORDER.length ? STEP_ORDER[earliestIndex] : 'authType';
}
