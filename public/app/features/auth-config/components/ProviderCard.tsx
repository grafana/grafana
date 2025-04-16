import { isIconName } from '@grafana/data';
import { Badge, Card, Icon } from '@grafana/ui';

import { t } from '../../../core/internationalization';
import { UIMap } from '../constants';
import { getProviderUrl } from '../utils/url';

type Props = {
  providerId: string;
  enabled: boolean;
  configPath?: string;
  authType?: string;
  onClick?: () => void;
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
        <Badge
          text={
            enabled
              ? t('auth-config.provider-card.text-badge-enabled', 'Enabled')
              : t('auth-config.provider-card.text-badge-not-enabled', 'Not enabled')
          }
          color={enabled ? 'green' : 'blue'}
        />
      </Card.Actions>
    </Card>
  );
}
