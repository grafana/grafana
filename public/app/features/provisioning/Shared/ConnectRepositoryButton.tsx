import { LinkButton } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';
import { Trans, t } from 'app/core/internationalization';

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
        tooltip={t(
          'provisioning.connect-repository-button.tooltip-max-repos',
          'Max repositories already created ({{count}})',
          { count: state.repoCount }
        )}
      >
        <Trans
          i18nKey="provisioning.connect-repository-button.max-repositories-exist"
          values={{ count: state.repoCount }}
          defaults={'Maximum repositories exist ({{count}})'}
        />
      </LinkButton>
    );
  }

  return (
    <LinkButton href={CONNECT_URL} variant="primary" icon="plus">
      <Trans i18nKey="provisioning.connect-repository-button.connect-to-repository">Connect to repository</Trans>
    </LinkButton>
  );
}
