import { css } from '@emotion/css';
import { type ReactElement, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import {
  type ContactPointWithMetadata,
  type ReceiverConfigWithMetadata,
} from 'app/features/alerting/unified/components/contact-points/utils';
import { useContactPointUsageSummary } from 'app/features/alerting/unified/triage/instance-details/useContactPointUsageSummary';

/** Instance drawer composes policy/rule rows elsewhere and passes them in; list cards use `contactPoint` only. */
export type ContactPointStackedUsageSectionsProps =
  | {
      contactPoint: ContactPointWithMetadata;
    }
  | {
      plain: true;
      policiesUsageRow: ReactElement;
      rulesUsageRow: ReactElement;
      /** Same as `contactPoint.grafana_managed_receiver_configs` when the parent also renders integrations. */
      integrations: ReceiverConfigWithMetadata[];
    };

/**
 * Policy + alert rule usage in a vertical stack. `Stack` / `Text` from @grafana/ui omit `className`;
 * apply layout styles on wrapper elements.
 */
export function ContactPointStackedUsageSections(props: ContactPointStackedUsageSectionsProps) {
  if ('plain' in props && props.plain) {
    return <ContactPointStackedUsagePlain {...props} />;
  }
  return <ContactPointStackedUsageFromContactPoint contactPoint={props.contactPoint} />;
}

function ContactPointStackedUsagePlain({
  policiesUsageRow,
  rulesUsageRow,
  integrations,
}: Extract<ContactPointStackedUsageSectionsProps, { plain: true }>) {
  const styles = useStyles2(getStyles);
  void integrations;

  return (
    <Stack direction="column" gap={1.5}>
      <div className={styles.usageBlock}>
        <Stack direction="column" gap={0.5}>
          {policiesUsageRow}
        </Stack>
      </div>
      <div className={styles.usageBlock}>
        <Stack direction="column" gap={0.5}>
          {rulesUsageRow}
        </Stack>
      </div>
    </Stack>
  );
}

function ContactPointStackedUsageFromContactPoint({ contactPoint }: { contactPoint: ContactPointWithMetadata }) {
  const styles = useStyles2(getStyles);
  const { policiesHref, rulesHref, policiesSentence, rulesSentence } = useContactPointUsageSummary(contactPoint);

  const sections: Array<{ key: string; body: ReactNode }> = [
    {
      key: 'policies',
      body: policiesHref ? (
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
      ),
    },
    {
      key: 'rules',
      body: rulesHref ? (
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
      ),
    },
  ];

  return (
    <Stack direction="column" gap={1.5}>
      {sections.map(({ key, body }) => (
        <div key={key} className={styles.usageBlock}>
          <Stack direction="column" gap={0.5}>
            {body}
          </Stack>
        </div>
      ))}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  usageBlock: css({
    minWidth: 0,
  }),
});
