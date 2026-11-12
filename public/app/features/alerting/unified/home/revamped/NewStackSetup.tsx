import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

interface SetupStep {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
}

/** Setup steps for a stack with no Grafana-managed rules, in the order they depend on each other. */
export function NewStackSetup() {
  const styles = useStyles2(getStyles);

  const steps: SetupStep[] = [
    {
      title: t('alerting.home.setup.rule-title', 'Create an alert rule'),
      description: t(
        'alerting.home.setup.rule-description',
        'Query a data source and set the condition that should fire. You can pick a contact point in the rule form, or add one in the next step.'
      ),
      actionLabel: t('alerting.home.setup.rule-action', 'Create alert rule'),
      href: '/alerting/new/alerting',
    },
    {
      title: t('alerting.home.setup.contact-point-title', 'Add a contact point'),
      description: t(
        'alerting.home.setup.contact-point-description',
        'Choose where notifications go: Slack, email, PagerDuty and others.'
      ),
      actionLabel: t('alerting.home.setup.contact-point-action', 'Add contact point'),
      href: '/alerting/notifications/receivers/new',
    },
    {
      title: t('alerting.home.setup.policy-title', 'Check the notification policy'),
      description: t(
        'alerting.home.setup.policy-description',
        'The default policy sends every alert to the default contact point. Add policies to route alerts by label.'
      ),
      actionLabel: t('alerting.home.setup.policy-action', 'Open notification policies'),
      href: '/alerting/routes',
    },
  ];

  return (
    <section className={styles.card} aria-labelledby="home-setup">
      <Text element="h2" variant="h4" id="home-setup">
        <Trans i18nKey="alerting.home.setup.title">Set up alerting</Trans>
      </Text>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.href}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <Stack direction="column" gap={0.5}>
              <Text weight="medium">{step.title}</Text>
              <Text color="secondary">{step.description}</Text>
              <TextLink href={step.href} inline={false}>
                {step.actionLabel}
              </TextLink>
            </Stack>
          </li>
        ))}
      </ol>
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  steps: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: theme.spacing(2),
    '& > li': { display: 'flex', gap: theme.spacing(1.5), alignItems: 'flex-start' },
  }),
  number: css({
    flex: 'none',
    width: theme.spacing(3),
    height: theme.spacing(3),
    borderRadius: theme.shape.radius.circle,
    display: 'grid',
    placeItems: 'center',
    border: `2px solid ${theme.colors.primary.border}`,
    color: theme.colors.primary.text,
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
