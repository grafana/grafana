import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import {
  DOCS_URL_ALERT_RULES,
  DOCS_URL_ALERT_RULE_STATE_AND_HEALTH,
  DOCS_URL_CONTACT_POINTS,
  DOCS_URL_NOTIFICATION_POLICIES,
  TUTORIAL_URL_ALERTING_GET_STARTED,
} from '../../utils/docs';
import { createRelativeUrl } from '../../utils/url';

import { BOX_GAP } from './layout';

interface SetupStep {
  title: string;
  description: string;
  actionLabel: string;
  href: `/${string}`;
}

/** What a stack with no Grafana-managed rules shows: the setup steps, then how the pieces fit together. */
export function NewStackSetup() {
  return (
    <Stack direction="column" gap={BOX_GAP}>
      <SetupSteps />
      <HowItWorks />
    </Stack>
  );
}

/**
 * Setup steps in the order they depend on each other. The page only shows them while the stack has
 * no rules, so creating a rule is always the step to do next.
 */
function SetupSteps() {
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
        {steps.map((step, index) => {
          const next = index === 0;
          return (
            <li key={step.href} className={styles.step}>
              <span className={cx(styles.number, next && styles.nextNumber)} aria-hidden="true">
                {index + 1}
              </span>
              <Stack direction="column" gap={0.25}>
                <Stack gap={1} alignItems="center" wrap="wrap">
                  <Text weight="medium">{step.title}</Text>
                  {next && <Badge color="orange" text={t('alerting.home.setup.next', 'Do this next')} />}
                </Stack>
                <Text color="secondary">{step.description}</Text>
              </Stack>
              <LinkButton
                variant={next ? 'primary' : 'secondary'}
                fill={next ? 'solid' : 'outline'}
                href={createRelativeUrl(step.href)}
              >
                {step.actionLabel}
              </LinkButton>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function HowItWorks() {
  const styles = useStyles2(getStyles);

  const concepts = [
    {
      title: t('alerting.home.how-it-works.rule-title', 'Alert rule'),
      description: t('alerting.home.how-it-works.rule-description', 'Queries a data source on a schedule'),
      docs: DOCS_URL_ALERT_RULES,
    },
    {
      title: t('alerting.home.how-it-works.instances-title', 'Alert instances'),
      description: t('alerting.home.how-it-works.instances-description', 'One per series that breaches the condition'),
      docs: DOCS_URL_ALERT_RULE_STATE_AND_HEALTH,
    },
    {
      title: t('alerting.home.how-it-works.policy-title', 'Notification policy'),
      description: t('alerting.home.how-it-works.policy-description', 'Routes instances by matching labels'),
      docs: DOCS_URL_NOTIFICATION_POLICIES,
    },
    {
      title: t('alerting.home.how-it-works.contact-point-title', 'Contact point'),
      description: t('alerting.home.how-it-works.contact-point-description', 'Sends the notification'),
      docs: DOCS_URL_CONTACT_POINTS,
    },
  ];

  return (
    <section className={styles.card} aria-labelledby="home-how-it-works">
      <div className={styles.header}>
        <Text element="h3" variant="h5" id="home-how-it-works">
          <Trans i18nKey="alerting.home.how-it-works.title">How it works</Trans>
        </Text>
        <TextLink href={TUTORIAL_URL_ALERTING_GET_STARTED} external variant="bodySmall">
          {t('alerting.home.how-it-works.tutorial', 'Read the tutorial')}
        </TextLink>
      </div>
      <div className={styles.concepts}>
        {concepts.map((concept) => (
          <div key={concept.title} className={styles.concept}>
            <Text element="h4" variant="body" weight="medium">
              <TextLink href={concept.docs} external inline={false}>
                {concept.title}
              </TextLink>
            </Text>
            <Text color="secondary" variant="bodySmall">
              {concept.description}
            </Text>
          </div>
        ))}
      </div>
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
    gap: theme.spacing(1.5),
  }),
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  }),
  // The rows share the list's columns, so the button column is as wide as the widest button and
  // every step's button gets that same width.
  steps: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gridTemplateColumns: `${theme.spacing(3)} minmax(0, 1fr) auto`,
    columnGap: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: `${theme.spacing(3)} minmax(0, 1fr)`,
    },
  }),
  step: css({
    display: 'grid',
    gridColumn: '1 / -1',
    gridTemplateColumns: 'subgrid',
    rowGap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(1.5, 0),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    '& > a': { justifySelf: 'stretch', justifyContent: 'center' },
    [theme.breakpoints.down('sm')]: {
      '& > a': { gridColumn: 2, justifySelf: 'start' },
    },
  }),
  number: css({
    width: theme.spacing(3),
    height: theme.spacing(3),
    borderRadius: theme.shape.radius.circle,
    display: 'grid',
    placeItems: 'center',
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  nextNumber: css({
    border: `2px solid ${theme.colors.primary.border}`,
    color: theme.colors.primary.text,
  }),
  concepts: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing(1.5),
  }),
  concept: css({
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    '& h4': { margin: 0 },
  }),
});
