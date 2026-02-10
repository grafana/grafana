import { t } from '@grafana/i18n';

import { Step } from '../Stepper';
import { RepoType, WizardStep } from '../types';

export const getSteps = (type: RepoType): Array<Step<WizardStep>> => {
  const isLocal = type === 'local';
  return [
    {
      id: 'authType',
      name: isLocal
        ? t('provisioning.wizard.connect-step-local', 'File Provisioning')
        : t('provisioning.wizard.connect-step', 'Connect'),
      title: isLocal
        ? t('provisioning.wizard.connect-step-local', 'File Provisioning')
        : t('provisioning.wizard.connect-step', 'Connect'),
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
