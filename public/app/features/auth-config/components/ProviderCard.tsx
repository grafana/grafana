import React from 'react';

import { IconName, isIconName } from '@grafana/data';
import { Badge, Card, Icon } from '@grafana/ui';

import { getProviderUrl } from '../utils/url';

type Props = {
  providerId: string;
  enabled: boolean;
  configPath?: string;
  authType?: string;
  onClick?: () => void;
};

// TODO Remove when this is available from API
const UIMap: Record<string, [IconName, string]> = {
  github: ['github', 'GitHub'],
  gitlab: ['gitlab', 'GitLab'],
  google: ['google', 'Google'],
  generic_oauth: ['lock', 'Generic OAuth'],
  grafana_com: ['grafana', 'Grafana.com'],
  azuread: ['microsoft', 'Azure AD'],
  okta: ['okta', 'Okta'],
};

export function ProviderCard({ providerId, enabled, configPath, authType, onClick }: Props) {
  //@ts-expect-error
  const url = getProviderUrl({ configPath, id: providerId });
  const [iconName, displayName] = UIMap[providerId] || ['lock', providerId.toUpperCase()];
  return (
    <Card href={url} onClick={onClick}>
      <Card.Heading>{displayName}</Card.Heading>
      <Card.Meta>{authType}</Card.Meta>
      {isIconName(iconName) && (
        <Card.Figure>
          <Icon name={iconName} size={'xxxl'} />
        </Card.Figure>
      )}
      <Card.Actions>
        <Badge text={enabled ? 'Enabled' : 'Not enabled'} color={enabled ? 'green' : 'blue'} />
      </Card.Actions>
    </Card>
  );
}
