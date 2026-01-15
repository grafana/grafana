import { Card, Stack, Text } from '@grafana/ui';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';

import { ConnectionStatusBadge } from '../Connection/ConnectionStatusBadge';
import { RepoIcon } from '../Shared/RepoIcon';

import { RepoType } from './types';

interface Props {
  connection: Connection;
  isSelected: boolean;
  onClick: () => void;
}

export function SelectableConnectionCard({ connection, isSelected, onClick }: Props) {
  const { metadata, spec, status } = connection;
  const name = metadata?.name ?? '';
  const providerType: RepoType = spec?.type ?? 'github';

  return (
    <Card noMargin isSelected={isSelected} onClick={onClick}>
      <Card.Figure>
        <RepoIcon type={providerType} />
      </Card.Figure>
      <Card.Heading>
        <Stack gap={2} direction="row" alignItems="center">
          <Text variant="h4">{name}</Text>
          {status?.state && <ConnectionStatusBadge status={status} />}
        </Stack>
      </Card.Heading>
    </Card>
  );
}
