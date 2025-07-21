import { css, cx } from '@emotion/css';
import * as React from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Stack, Text, TextLink, useStyles2, useTheme2 } from '@grafana/ui';
import atAGlanceDarkSvg from 'img/alerting/at_a_glance_dark.svg';
import atAGlanceLightSvg from 'img/alerting/at_a_glance_light.svg';

export default function GettingStarted() {
  const theme = useTheme2();
  const styles = useStyles2(getWelcomePageStyles);

  const atAGlanceImage = theme.name === 'dark' ? atAGlanceDarkSvg : atAGlanceLightSvg;

  return (
    <div className={styles.grid}>
      <ContentBox>
        <Stack direction="column" gap={1}>
          <Text element="h3">
            <Trans i18nKey="alerting.getting-started.how-it-works">How it works</Trans>
          </Text>
          <ul className={styles.list}>
            <li>
              <Trans i18nKey="alerting.getting-started.periodically-queries-data-sources">
                Grafana alerting periodically queries data sources and evaluates the condition defined in the alert rule
              </Trans>
            </li>
            <li>
              <Trans i18nKey="alerting.getting-started.condition-breached-alert-instance-fires">
                If the condition is breached, an alert instance fires
              </Trans>
            </li>
            <li>
              <Trans i18nKey="alerting.getting-started.firing-instances-routed-notification-policies">
                Firing instances are routed to notification policies based on matching labels
              </Trans>
            </li>
            <li>
              <Trans i18nKey="alerting.getting-started.notification-policies-contact-points">
                Notifications are sent out to the contact points specified in the notification policy
              </Trans>
            </li>
          </ul>
          <div className={styles.svgContainer}>
            <Stack justifyContent={'center'}>
              <SVG src={atAGlanceImage} width={undefined} height={undefined} />
            </Stack>
          </div>
        </Stack>
      </ContentBox>
      <ContentBox>
        <Stack direction="column" gap={1}>
          <Text element="h3">
            <Trans i18nKey="alerting.getting-started.get-started">Get started</Trans>
          </Text>
          <ul className={styles.list}>
            <li>
              <Trans i18nKey="alerting.getting-started.create-alert-rule">
                <Text weight="bold">Create an alert rule</Text> to query a data source and evaluate the condition
                defined in the alert rule
              </Trans>
            </li>
            <li>
              <Trans i18nKey="alerting.getting-started.route-alert-notifications">
                <Text weight="bold">Route alert notifications</Text> either directly to a contact point or through
                notification policies for more flexibility
              </Trans>
            </li>
            <li>
              <Trans i18nKey="alerting.getting-started.monitor-alert-rules">
                <Text weight="bold">Monitor</Text> your alert rules using dashboards and visualizations
              </Trans>
            </li>
          </ul>
          <p>
            <Trans i18nKey="alerting.getting-stared.learn-more">
              For a hands-on introduction, refer to our{' '}
              <TextLink href="https://grafana.com/tutorials/alerting-get-started/" inline={true} external>
                tutorial to get started with Grafana Alerting
              </TextLink>
            </Trans>
          </p>
        </Stack>
      </ContentBox>
    </div>
  );
}

const getWelcomePageStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gridTemplateRows: 'min-content auto auto',
    gridTemplateColumns: '1fr',
    gap: theme.spacing(2),
    width: '100%',

    [theme.breakpoints.up('lg')]: {
      gridTemplateColumns: '3fr 2fr',
    },
  }),
  ctaContainer: css({
    gridColumn: '1 / span 5',
  }),
  svgContainer: css({
    '& svg': {
      maxWidth: '900px',
      flex: 1,
    },
  }),
  list: css({
    margin: theme.spacing(0, 2),
    '& > li': {
      marginBottom: theme.spacing(1),
    },
  }),
});

export function WelcomeHeader({ className }: { className?: string }) {
  const styles = useStyles2(getWelcomeHeaderStyles);

  return (
    <Stack gap={2} direction="column">
      <ContentBox className={cx(styles.ctaContainer, className)}>
        <WelcomeCTABox
          title={t('alerting.welcome-header.title-alert-rules', 'Alert rules')}
          description={t(
            'alerting.welcome-header.description-alert-rules',
            'Define the condition that must be met before an alert rule fires'
          )}
          href="/alerting/list"
          hrefText="Manage alert rules"
        />
        <div className={styles.separator} />
        <WelcomeCTABox
          title={t('alerting.welcome-header.title-contact-points', 'Contact points')}
          description={t(
            'alerting.welcome-header.description-configure-receives-notifications',
            'Configure who receives notifications and how they are sent'
          )}
          href="/alerting/notifications"
          hrefText="Manage contact points"
        />
        <div className={styles.separator} />
        <WelcomeCTABox
          title={t('alerting.welcome-header.title-notification-policies', 'Notification policies')}
          description={t(
            'alerting.welcome-header.description-configure-firing-alert-instances-routed-contact',
            'Configure how firing alert instances are routed to contact points'
          )}
          href="/alerting/routes"
          hrefText="Manage notification policies"
        />
      </ContentBox>
    </Stack>
  );
}

const getWelcomeHeaderStyles = (theme: GrafanaTheme2) => ({
  ctaContainer: css({
    padding: theme.spacing(2),
    display: 'flex',
    gap: theme.spacing(4),
    justifyContent: 'space-between',
    flexWrap: 'wrap',

    [theme.breakpoints.down('lg')]: {
      flexDirection: 'column',
    },
  }),
  separator: css({
    width: '1px',
    backgroundColor: theme.colors.border.medium,

    [theme.breakpoints.down('lg')]: {
      display: 'none',
    },
  }),
});

interface WelcomeCTABoxProps {
  title: string;
  description: string;
  href: string;
  hrefText: string;
}

function WelcomeCTABox({ title, description, href, hrefText }: WelcomeCTABoxProps) {
  const styles = useStyles2(getWelcomeCTAButtonStyles);

  return (
    <div className={styles.container}>
      <Text element="h2" variant="h3">
        {title}
      </Text>
      <div className={styles.desc}>{description}</div>
      <div className={styles.actionRow}>
        <TextLink href={href} inline={false}>
          {hrefText}
        </TextLink>
      </div>
    </div>
  );
}

const getWelcomeCTAButtonStyles = (theme: GrafanaTheme2) => ({
  container: css({
    color: theme.colors.text.primary,
    flex: 1,
    minWidth: '240px',
    display: 'grid',
    rowGap: theme.spacing(1),
    gridTemplateColumns: 'min-content 1fr 1fr 1fr',
    gridTemplateRows: 'min-content auto min-content',

    '& h2': {
      marginBottom: 0,
      gridColumn: '2 / span 3',
      gridRow: 1,
    },
  }),

  desc: css({
    gridColumn: '2 / span 3',
    gridRow: 2,
  }),

  actionRow: css({
    gridColumn: '2 / span 3',
    gridRow: 3,
    maxWidth: '240px',
  }),
});

function ContentBox({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  const styles = useStyles2(getContentBoxStyles);

  return <div className={cx(styles.box, className)}>{children}</div>;
}

const getContentBoxStyles = (theme: GrafanaTheme2) => ({
  box: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
});
