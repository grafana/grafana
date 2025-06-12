import { isIconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Card, Icon, Link, TextLink } from '@grafana/ui';

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
    <Card href={url} onClick={onClick} noMargin>
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

export function ProviderSAMLCard() {
  return (
    <Card noMargin>
      <Card.Heading>SAML</Card.Heading>
      <Card.Meta>
        <TextLink
          external
          variant="bodySmall"
          color="secondary"
          href="https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/saml/"
        >
          {t('auth-config.provider-card.enterprise-learn-more', 'Learn more about SAML support.')}
        </TextLink>
      </Card.Meta>
      <Card.Actions>
        <Badge text={t('auth-config.provider-card.text-badge-not-enabled', 'Not enabled')} color={'blue'} />
        <Badge text={'Enterprise only'} color={'purple'} tooltip={'Only available in Grafana Enterprise'} />
      </Card.Actions>
    </Card>
  );
}

export function ProviderSCIMCard() {
  return (
    <Card noMargin>
      <Card.Heading>SCIM</Card.Heading>
      <Card.Meta>
        <div>
          <TextLink
            external
            variant="bodySmall"
            color="secondary"
            href="https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/saml/"
          >
            {t('auth-config.provider-card.enterprise-learn-more', ' Sync users and teams with SCIM.')}
          </TextLink>
        </div>
      </Card.Meta>
      <Card.Actions>
        <Badge text={t('auth-config.provider-card.text-badge-not-enabled', 'Not enabled')} color={'blue'} />
        <Badge text={'Enterprise only'} color={'purple'} tooltip={'Only available in Grafana Enterprise'} />
      </Card.Actions>
    </Card>
  );
}
