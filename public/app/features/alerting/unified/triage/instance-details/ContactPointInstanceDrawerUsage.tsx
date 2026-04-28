import { t } from '@grafana/i18n';
import { Stack, Text, TextLink } from '@grafana/ui';
import { type ContactPointWithMetadata } from 'app/features/alerting/unified/components/contact-points/utils';

import { useContactPointUsageSummary } from './useContactPointUsageSummary';

/** Policy + alert-rule lines: whole line links when there is a target; matching typography. */
export function ContactPointInstanceDrawerUsage({ contactPoint }: { contactPoint: ContactPointWithMetadata }) {
  const { policiesHref, rulesHref, policiesSentence, rulesSentence } = useContactPointUsageSummary(contactPoint);

  return (
    <Stack direction="column" gap={1}>
      {policiesHref ? (
        <TextLink
          href={policiesHref}
          variant="body"
          color="primary"
          icon="external-link-alt"
          inline={false}
          aria-label={t(
            'alerting.contact-point-instance-drawer.aria-usage-policies',
            'Open notification policies that use this contact point'
          )}
        >
          {policiesSentence}
        </TextLink>
      ) : (
        <Text variant="body" color="secondary">
          {policiesSentence}
        </Text>
      )}
      {rulesHref ? (
        <TextLink
          href={rulesHref}
          variant="body"
          color="primary"
          icon="external-link-alt"
          inline={false}
          aria-label={t(
            'alerting.contact-point-instance-drawer.aria-usage-rules',
            'Open alert rules that use this contact point for simplified routing'
          )}
        >
          {rulesSentence}
        </TextLink>
      ) : (
        <Text variant="body" color="secondary">
          {rulesSentence}
        </Text>
      )}
    </Stack>
  );
}
