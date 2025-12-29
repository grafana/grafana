import { Trans } from '@grafana/i18n';
import { Card, LinkButton, Stack, Text, TextLink } from '@grafana/ui';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';

import { RepoIcon } from '../Shared/RepoIcon';
import { CONNECTIONS_URL } from '../constants';

import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { DeleteConnectionButton } from './DeleteConnectionButton';

interface Props {
  connection: Connection;
}

export function ConnectionListItem({ connection }: Props) {
  const { metadata, spec, status } = connection;
  const name = metadata?.name ?? '';
  const providerType = spec?.type;
  const url = spec?.url;

  return (
    <Card noMargin key={name}>
      <Card.Figure>
        <RepoIcon type={providerType} />
      </Card.Figure>
      <Card.Heading>
        <Stack gap={2} direction="row" alignItems="center">
          <Text variant="h3">{name}</Text>
          <ConnectionStatusBadge status={status} />
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
          <DeleteConnectionButton name={name} connection={connection} />
        </Stack>
      </Card.Actions>
    </Card>
  );
}
