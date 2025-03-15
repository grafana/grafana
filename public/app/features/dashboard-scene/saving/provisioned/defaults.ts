import { RepositorySpec } from 'app/api/clients/provisioning';
import { WorkflowOption } from 'app/features/provisioning/types';

export function getDefaultWorkflow(config?: RepositorySpec) {
  return config?.workflows?.[0];
}

export function getWorkflowOptions(config?: RepositorySpec, ref?: string) {
  if (!config) {
    return [];
  }

  if (config.local?.path) {
    return [{ label: `Write to ${config.local.path}`, value: 'write' }];
  }

  let branch = ref ?? config.github?.branch;
  const availableOptions: Array<{ label: string; value: WorkflowOption }> = [
    { label: `Push to ${branch ?? 'main'}`, value: 'write' },
    { label: 'Push to different branch', value: 'branch' },
  ];

  // Filter options based on the workflows in the config
  return availableOptions.filter((option) => config.workflows?.includes(option.value));
}
