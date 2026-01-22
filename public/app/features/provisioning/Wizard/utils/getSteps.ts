import { t } from '@grafana/i18n';

import { Step } from '../Stepper';
import { GitHubAuthType, RepoType, WizardStep } from '../types';

export const getSteps = (type: RepoType, githubAuthType?: GitHubAuthType): Array<Step<WizardStep>> => {
  const steps: Array<Step<WizardStep>> = [];

  // For GitHub, add auth type selection step
  if (type === 'github') {
    steps.push({
      id: 'authType',
      name: t('provisioning.wizard.step-auth-type', 'Choose connection type'),
      title: t('provisioning.wizard.title-auth-type', 'Choose connection type'),
      submitOnNext: false,
    });

    // If GitHub App is selected, add the GitHub App configuration step
    if (githubAuthType === 'github-app') {
      steps.push({
        id: 'githubApp',
        name: t('provisioning.wizard.step-github-app', 'Connect'),
        title: t('provisioning.wizard.title-github-app', 'Connect to GitHub'),
        submitOnNext: true,
      });
    }
  }

  // Connection step (always present, but fields vary)
  steps.push({
    id: 'connection',
    name:
      type === 'github' && githubAuthType === 'github-app'
        ? t('provisioning.wizard.step-configure-repo', 'Configure repository')
        : t('provisioning.wizard.step-connect', 'Connect'),
    title:
      type === 'github' && githubAuthType === 'github-app'
        ? t('provisioning.wizard.title-configure-repo', 'Configure repository')
        : t('provisioning.wizard.title-connect', 'Connect to external storage'),
    submitOnNext: true,
  });

  steps.push(
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
    }
  );

  return steps;
};
