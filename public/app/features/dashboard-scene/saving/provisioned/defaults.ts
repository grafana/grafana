import { RepositorySpec } from 'app/features/provisioning/api';
import { WorkflowOption } from 'app/features/provisioning/types';

export function getDefaultWorkflow(config?: RepositorySpec) {
  return config?.github?.branchWorkflow ? WorkflowOption.PullRequest : WorkflowOption.Direct;
}

export function getWorkflowOptions(branch = 'main') {
  return [
    { label: `Commit to ${branch}`, value: WorkflowOption.Direct },
    { label: 'Create pull request', value: WorkflowOption.PullRequest },
  ];
}
