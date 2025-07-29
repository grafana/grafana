import { useNavigate } from 'react-router-dom-v5-compat';

import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { buildResourceBranchRedirectUrl } from 'app/features/dashboard-scene/settings/utils';

import { MoveResultSuccessState } from './utils';

interface Props {
  workflow?: 'branch' | 'write';
  repository: RepositoryView;
  successState: MoveResultSuccessState;
  onDismiss?: () => void;
}
export function useBulkActionRequest({ workflow, repository, successState, onDismiss }: Props) {
  const navigate = useNavigate();

  const handleSuccess = () => {
    if (workflow === 'branch') {
      onDismiss?.();
      if (successState.repoUrl) {
        const url = buildResourceBranchRedirectUrl({
          paramName: 'repo_url',
          paramValue: successState.repoUrl,
          repoType: repository.type,
        });

        navigate(url);
        return;
      }
      window.location.reload();
    } else {
      onDismiss?.();
      window.location.reload();
    }
  };
  return {
    handleSuccess,
  };
}
