import { isIconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Card, Icon, TextLink } from '@grafana/ui';
import { CloudEnterpriseBadge } from 'app/core/components/Branding/CloudEnterpriseBadge';

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
      {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
      <Card.Heading>SAML</Card.Heading>
      <Card.Meta>
        <TextLink
          external
          variant="bodySmall"
          color="secondary"
          href="https://grafana.com/auth/sign-up/create-user?cloud-auth=&redirectPath=cloud-auth&utm_source=oss-grafana&cnt=admin-authorization-saml"
        >
          {t('auth-config.provider-card.saml-learn-more', 'Single sign-on (SSO) with SAML.')}
        </TextLink>
      </Card.Meta>
      <Card.Figure>
        <Icon name="lock" size={'xxxl'} />
      </Card.Figure>
      <Card.Actions>
        <CloudEnterpriseBadge />
      </Card.Actions>
    </Card>
  );
}

export function ProviderSCIMCard() {
  return (
    <Card noMargin>
      {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
      <Card.Heading>SCIM</Card.Heading>
      <Card.Meta>
        <div>
          <TextLink
            external
            variant="bodySmall"
            color="secondary"
            href="https://grafana.com/auth/sign-up/create-user?cloud-auth=&redirectPath=cloud-auth&utm_source=oss-grafana&cnt=admin-authorization-scim"
          >
            {t('auth-config.provider-card.scim-learn-more', ' Sync users and teams with SCIM.')}
          </TextLink>
        </div>
      </Card.Meta>
      <Card.Figure>
        <Icon name="sync" size={'xxxl'} />
      </Card.Figure>
      <Card.Actions>
        <CloudEnterpriseBadge />
      </Card.Actions>
    </Card>
  );
}
