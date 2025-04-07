import { RepositoryView } from 'app/api/clients/provisioning';
import { WorkflowOption } from 'app/features/provisioning/types';

export function getDefaultWorkflow(config?: RepositoryView) {
  return config?.workflows?.[0];
}

export function getWorkflowOptions(config?: RepositoryView, ref?: string) {
  if (!config) {
    return [];
  }

  if (config.type === 'local') {
    return [{ label: `Save`, value: 'write' }];
  }

  // When a branch is configured, show it
  if (!ref && config.branch) {
    ref = config.branch;
  }

  const availableOptions: Array<{ label: string; value: WorkflowOption }> = [
    { label: ref ? `Push to ${ref}` : 'Save', value: 'write' },
    { label: 'Push to different branch', value: 'branch' },
  ];

  // Filter options based on the workflows in the config
  return availableOptions.filter((option) => config.workflows?.includes(option.value));
}
