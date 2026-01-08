import { Trans } from '@grafana/i18n';
import { Card, LinkButton, Stack, Text, TextLink } from '@grafana/ui';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';

import { RepoIcon } from '../Shared/RepoIcon';
import { RepoType } from '../Wizard/types';
import { CONNECTIONS_URL } from '../constants';
import { getRepositoryTypeConfigs } from '../utils/repositoryTypes';

import { ConnectionStatusBadge } from './ConnectionStatusBadge';

interface Props {
  connection: Connection;
}

export function ConnectionListItem({ connection }: Props) {
  const { metadata, spec, status } = connection;
  const name = metadata?.name ?? '';
  const url = spec?.url;
  const providerType: RepoType = spec?.type ?? 'github';
  const repoConfig = getRepositoryTypeConfigs().find((config) => config.type === providerType);
  return (
    <Card noMargin key={name}>
      <Card.Figure>
        <RepoIcon type={providerType} />
      </Card.Figure>
      <Card.Heading>
        <Stack gap={2} direction="row" alignItems="center">
          {repoConfig && <Text variant="h3">{`${repoConfig.label} app connection`}</Text>}
          {status?.state && <ConnectionStatusBadge status={status} />}
        </Stack>
      </Card.Heading>

      {url && (
        <Card.Meta>
          <TextLink external href={url}>
            {url}
          </TextLink>
        </Card.Meta>
      )}

      <Card.Actions>
        <Stack gap={1} direction="row">
          <LinkButton icon="eye" href={`${CONNECTIONS_URL}/${name}`} variant="primary" size="md">
            <Trans i18nKey="provisioning.connections.view">View</Trans>
          </LinkButton>
          <LinkButton variant="secondary" icon="cog" href={`${CONNECTIONS_URL}/${name}/edit`} size="md">
            <Trans i18nKey="provisioning.connections.settings">Settings</Trans>
          </LinkButton>
        </Stack>
      </Card.Actions>
    </Card>
  );
}
