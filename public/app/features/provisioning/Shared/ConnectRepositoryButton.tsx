import { Alert, LinkButton, Stack } from '@grafana/ui';
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
      <Alert title="" severity="info">
        <Trans
          i18nKey="provisioning.connect-repository-button.repository-limit-info-alert"
          values={{ count: state.repoCount }}
          defaults={'Repository limit reached ({{count}})'}
        />
      </Alert>
    );
  }

  return (
    <Stack gap={3}>
      <LinkButton href={CONNECT_URL} variant="primary">
        <Trans i18nKey="provisioning.connect-repository-button.configure-git-sync">Configure GitSync</Trans>
      </LinkButton>
      <LinkButton href={CONNECT_URL} variant="secondary">
        <Trans i18nKey="provisioning.connect-repository-button.configure-file">Configure file provisioning</Trans>
      </LinkButton>
    </Stack>
  );
}
