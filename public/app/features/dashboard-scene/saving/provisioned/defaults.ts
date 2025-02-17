import { RepositorySpec } from 'app/features/provisioning/api';
import { WorkflowOption } from 'app/features/provisioning/types';

export function getDefaultWorkflow(config?: RepositorySpec) {
  return config?.github?.workflows?.[0];
}

export function getWorkflowOptions(config?: RepositorySpec) {
  if (!config) {
    return [];
  }

  const availableOptions: Array<{ label: string; value: WorkflowOption }> = [
    { label: `Push to ${config.github?.branch}`, value: 'push' },
    { label: 'Push to different branch', value: 'branch' },
  ];

  // Filter options based on the workflows in the config
  return availableOptions.filter((option) => config.github?.workflows?.includes(option.value));
}
