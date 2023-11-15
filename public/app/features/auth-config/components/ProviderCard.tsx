import React from 'react';

import { IconName } from '@grafana/data';
import { Badge, Card, Icon } from '@grafana/ui';

import { BASE_PATH } from '../constants';

type Props = {
  providerId: string;
  displayName: string;
  enabled: boolean;
  configPath?: string;
  authType?: string;
  badges?: JSX.Element[];
  onClick?: () => void;
};

export function ProviderCard({ providerId, displayName, enabled, configPath, authType, badges, onClick }: Props) {
  configPath = BASE_PATH + (configPath || providerId);
  return (
    <Card href={configPath} onClick={onClick}>
      <Card.Heading>{displayName}</Card.Heading>
      <Card.Meta>{authType}</Card.Meta>
      <Card.Figure>
        <Icon name={providerId as IconName} size={'xxxl'} />
      </Card.Figure>
      <Card.Actions>
        <Badge text={enabled ? 'Enabled' : 'Not enabled'} color={enabled ? 'green' : 'blue'} />
      </Card.Actions>
    </Card>
  );
}
