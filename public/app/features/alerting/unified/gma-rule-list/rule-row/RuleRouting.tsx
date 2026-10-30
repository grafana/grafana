import { Trans, t } from '@grafana/i18n';
import { Icon, Stack, Text, TextLink } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { createContactPointSearchLink } from '../../utils/misc';
import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';

interface RuleRoutingProps {
  searchHit: AlertRuleSearchHit;
}

export function RuleRouting({ searchHit }: RuleRoutingProps) {
  const { notificationType, receiver, routingTree } = searchHit;

  if (!notificationType) {
    return null;
  }

  if (notificationType === 'SimplifiedRouting' && !receiver) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Icon name="at" size="xs" />
      <RoutingLabel notificationType={notificationType} receiver={receiver} routingTree={routingTree} />
    </Stack>
  );
}

interface RoutingLabelProps {
  notificationType: 'SimplifiedRouting' | 'NamedRoutingTree';
  receiver?: string;
  routingTree?: string;
}

function RoutingLabel({ notificationType, receiver, routingTree }: RoutingLabelProps) {
  if (notificationType === 'SimplifiedRouting' && receiver) {
    return (
      <>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.gma-rule-list.routing.delivered-to">Delivered to</Trans>
        </Text>
        <TextLink
          variant="bodySmall"
          inline={false}
          href={createContactPointSearchLink(receiver, GRAFANA_RULES_SOURCE_NAME)}
        >
          {receiver}
        </TextLink>
      </>
    );
  }

  if (routingTree) {
    return (
      <Text variant="bodySmall" color="secondary">
        {t('alerting.gma-rule-list.routing.policy', 'Policy: {{name}}', {
          name: routingTree,
          interpolation: { escapeValue: false },
        })}
      </Text>
    );
  }

  return (
    <Text variant="bodySmall" color="secondary">
      <Trans i18nKey="alerting.gma-rule-list.routing.default-policy">Default policy</Trans>
    </Text>
  );
}
