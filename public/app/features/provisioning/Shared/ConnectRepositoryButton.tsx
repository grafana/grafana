import { LinkButton } from '@grafana/ui';
import { RepositoryViewList } from 'app/api/clients/provisioning';

import { CONNECT_URL } from '../constants';
import { checkSyncSettings } from '../utils/checkSyncSettings';

interface Props {
  settings?: RepositoryViewList;
}

export function ConnectRepositoryButton({ settings }: Props) {
  const [instanceConnected, maxReposReached] = checkSyncSettings(settings);

  if (instanceConnected || maxReposReached) {
    return null;
  }

  return (
    <LinkButton href={CONNECT_URL} variant="primary" icon="plus">
      Connect to repository
    </LinkButton>
  );
}
