import { LinkButton } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

import { CONNECT_URL } from '../constants';
import { checkSyncSettings } from '../utils/checkSyncSettings';

interface Props {
  items?: Repository[];
}

export function ConnectRepositoryButton({ items }: Props) {
  const state = checkSyncSettings(items);

  if (state.instanceConnected) {
    return null;
  }

  if (state.maxReposReached) {
    return (
      <LinkButton
        href={CONNECT_URL}
        variant="primary"
        icon="plus"
        disabled={true}
        tooltip={`Max repositories already created (${state.repoCount})`}
      >
        Maximum repositories exist ({state.repoCount})
      </LinkButton>
    );
  }

  return (
    <LinkButton href={CONNECT_URL} variant="primary" icon="plus"><Trans i18nKey="provisioning.connect-repository-button.connect-to-repository">
      Connect to repository
    </Trans></LinkButton>
  );
}
