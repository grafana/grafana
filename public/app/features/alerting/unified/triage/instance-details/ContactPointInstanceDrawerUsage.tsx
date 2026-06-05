import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { type ContactPointWithMetadata } from 'app/features/alerting/unified/components/contact-points/utils';

import { useContactPointUsageSummary } from './useContactPointUsageSummary';

const linkProps = {
  variant: 'bodySmall' as const,
  color: 'primary' as const,
  icon: 'external-link-alt' as const,
  inline: false as const,
};

/** Drawer/scroll ancestors can skew the first row; reset anchor + icon so both usage lines match. */
const getStyles = (theme: GrafanaTheme2) => ({
  line: css({
    '& a': {
      ...theme.typography.bodySmall,
      color: theme.colors.text.primary,
      textDecoration: 'none',
      '&:hover': {
        color: theme.colors.text.link,
        textDecoration: 'underline',
      },
    },
    // TextLink bodySmall uses Icon size `xs` (12px)
    '& a svg': { width: 12, height: 12 },
  }),
});

export function ContactPointInstanceDrawerUsage({ contactPoint }: { contactPoint: ContactPointWithMetadata }) {
  const styles = useStyles2(getStyles);
  const summary = useContactPointUsageSummary(contactPoint);

  const rows = [
    {
      key: 'policies',
      href: summary.policiesHref,
      sentence: summary.policiesSentence,
      ariaLabel: t(
        'alerting.contact-point-instance-drawer.aria-usage-policies',
        'Open notification policies that use this contact point'
      ),
    },
    {
      key: 'rules',
      href: summary.rulesHref,
      sentence: summary.rulesSentence,
      ariaLabel: t(
        'alerting.contact-point-instance-drawer.aria-usage-rules',
        'Open alert rules that use this contact point for simplified routing'
      ),
    },
  ];

  return (
    <Stack direction="column" gap={1}>
      {rows.map(({ key, href, sentence, ariaLabel }) => (
        <div key={key} className={styles.line}>
          {href ? (
            <TextLink href={href} {...linkProps} aria-label={ariaLabel}>
              {sentence}
            </TextLink>
          ) : (
            <Text variant={linkProps.variant} color="secondary">
              {sentence}
            </Text>
          )}
        </div>
      ))}
    </Stack>
  );
}
