import { RepositoryView } from 'app/api/clients/provisioning';

export function getDefaultWorkflow(config?: RepositoryView, loadedFromRef?: string) {
  if (loadedFromRef && loadedFromRef !== config?.branch) {
    return 'write'; // use write when the value targets an explicit ref
  }
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

  // Return the workflows in the configured order
  return config.workflows.map((value) => {
    switch (value) {
      case 'write':
        return { label: ref ? `Push to ${ref}` : 'Save', value };
      case 'branch':
        return { label: 'Push to a new branch', value };
    }
    return { label: value, value };
  });
}
