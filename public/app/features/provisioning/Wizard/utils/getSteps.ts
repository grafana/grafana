import { t } from '@grafana/i18n';

import { isGitProvider } from '../../utils/repositoryTypes';
import { Step } from '../Stepper';
import { GitHubAuthType, RepoType, WizardStep } from '../types';

export const getSteps = (type: RepoType, githubAuthType?: GitHubAuthType): Array<Step<WizardStep>> => {
  return [
    {
      id: 'authType',
      name: t('provisioning.wizard.connect-step', 'Connect'),
      title: t('provisioning.wizard.connect-step', 'Connect'),
      submitOnNext: true,
    },
    {
      id: 'connection',
      name: t('provisioning.wizard.step-configure-repo', 'Configure repository'),
      title: isGitProvider(type)
        ? t('provisioning.wizard.title-configure-repo', 'Configure repository')
        : t('provisioning.wizard.title-connect', 'Connect to external storage'),
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
