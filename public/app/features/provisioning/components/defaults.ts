import { t } from '@grafana/i18n';
import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

export function getDefaultWorkflow(config?: RepositoryView, loadedFromRef?: string) {
  if (loadedFromRef && loadedFromRef !== config?.branch) {
    return 'write'; // use write when the value targets an explicit ref
  }
  return config?.workflows?.[0];
}

export function getWorkflowOptions(config?: RepositoryView) {
  if (!config) {
    return [];
  }

  if (config.type === 'local') {
    return [{ label: `Save`, value: 'write' }];
  }

  // Return the workflows in the configured order
  return config.workflows.map((value) => {
    switch (value) {
      case 'write':
        return {
          label: t('provisioning.get-workflow-options.label.push-to-existing-branch', 'Push to existing branch'),
          value,
        };
      case 'branch':
        return {
          label: t('dashboard-scene.get-workflow-options.label.push-to-a-new-branch', 'Push to a new branch'),
          value,
        };
    }
    return { label: value, value };
  });
}
