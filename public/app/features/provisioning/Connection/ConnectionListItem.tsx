import { textUtil } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Card, LinkButton, Stack, Text, TextLink } from '@grafana/ui';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';

import { RepoIcon } from '../Shared/RepoIcon';
import { RepoType } from '../Wizard/types';
import { CONNECTIONS_URL } from '../constants';

import { ConnectionStatusBadge } from './ConnectionStatusBadge';

interface Props {
  connection: Connection;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ConnectionListItem({ connection, isSelected, onClick }: Props) {
  const { metadata, spec, status } = connection;
  const name = metadata?.name ?? '';
  const title = spec?.title || name;
  const description = spec?.description;
  const url = spec?.url;
  const providerType: RepoType = spec?.type ?? 'github';
  return (
    <Card noMargin key={name} isSelected={isSelected} onClick={onClick}>
      <Card.Figure>
        <RepoIcon type={providerType} />
      </Card.Figure>
      <Card.Heading>
        <Stack gap={2} direction="row" alignItems="center">
          <Text variant="h3">{title}</Text>
          <ConnectionStatusBadge status={status} />
        </Stack>
      </Card.Heading>

      {(description || url) && (
        <Card.Meta>
          <Stack direction="column">
            {description && <Text color="secondary">{description}</Text>}
            {url && (
              <TextLink external href={textUtil.sanitizeUrl(url)}>
                {url}
              </TextLink>
            )}
          </Stack>
        </Card.Meta>
      )}

      {!onClick && (
        <Card.Actions>
          <LinkButton icon="eye" href={`${CONNECTIONS_URL}/${name}/edit`} variant="primary" size="md">
            <Trans i18nKey="provisioning.connections.view">View</Trans>
          </LinkButton>
        </Card.Actions>
      )}
    </Card>
  );
}
