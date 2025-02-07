import { RepositorySpec } from 'app/features/provisioning/api';
import { WorkflowOption, mapToWorkflowOption } from 'app/features/provisioning/types';

export function getDefaultWorkflow(config?: RepositorySpec) {
  return config?.github?.workflows ? mapToWorkflowOption(config?.github?.workflows[0]) : undefined;
}

export function getWorkflowOptions(config?: RepositorySpec) {
  if (!config) {
    return [];
  }

  const availableOptions = [
    { label: `Push to ${config.github?.branch}`, value: WorkflowOption.Push },
    { label: 'Push to Different Branch', value: WorkflowOption.Branch },
  ];

  // Filter options based on the workflows in the config
  return availableOptions.filter((option) => config.github?.workflows?.includes(option.value));
}
