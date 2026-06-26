import { useFormContext } from 'react-hook-form';

import { type ConnectionType, type WizardFormData } from '../Wizard/types';
import { isGitHubBased } from '../utils/repositoryTypes';

/**
 * Derives the connection type from the wizard's repository.type and keeps it in sync automatically:
 * it watches repository.type and returns the narrowed ConnectionType ('github' | 'githubEnterprise'),
 * or undefined for non-GitHub repository types. Avoids storing redundant derived state on the form.
 */
export function useConnectionType(): ConnectionType | undefined {
  const { watch } = useFormContext<WizardFormData>();
  const repoType = watch('repository.type');
  return isGitHubBased(repoType) ? repoType : undefined;
}
