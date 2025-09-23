import { css, cx } from '@emotion/css';
import * as React from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, TextLink, useStyles2, useTheme2 } from '@grafana/ui';

export default function GettingStarted() {
  const theme = useTheme2();
  const styles = useStyles2(getWelcomePageStyles);

  return (
    <div className={styles.grid}>
      <ContentBox>
        <Stack direction="column" gap={1}>
          <Text element="h3">How it works</Text>
          <ul className={styles.list}>
            <li>
              Grafana alerting periodically queries data sources and evaluates the condition defined in the alert rule
            </li>
            <li>If the condition is breached, an alert instance fires</li>
            <li>Firing instances are routed to notification policies based on matching labels</li>
            <li>Notifications are sent out to the contact points specified in the notification policy</li>
          </ul>
          <div className={styles.svgContainer}>
            <Stack justifyContent={'center'}>
              <SVG
                src={`public/img/alerting/at_a_glance_${theme.name.toLowerCase()}.svg`}
                width={undefined}
                height={undefined}
              />
            </Stack>
          </div>
        </Stack>
      </ContentBox>
      <ContentBox>
        <Stack direction="column" gap={1}>
          <Text element="h3">Get started</Text>
          <ul className={styles.list}>
            <li>
              <Text weight="bold">Create an alert rule</Text> to query a data source and evaluate the condition defined
              in the alert rule
            </li>
            <li>
              <Text weight="bold">Route alert notifications</Text> either directly to a contact point or through
              notification policies for more flexibility
            </li>
            <li>
              <Text weight="bold">Monitor</Text> your alert rules using dashboards and visualizations
            </li>
          </ul>
          <p>
            For a hands-on introduction, refer to our{' '}
            <TextLink
              href="https://grafana.com/tutorials/alerting-get-started/"
              icon="angle-right"
              inline={true}
              external
            >
              tutorial to get started with Grafana Alerting
            </TextLink>
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
          title="Alert rules"
          description="Define the condition that must be met before an alert rule fires"
          href="/alerting/list"
          hrefText="Manage alert rules"
        />
        <div className={styles.separator} />
        <WelcomeCTABox
          title="Contact points"
          description="Configure who receives notifications and how they are sent"
          href="/alerting/notifications"
          hrefText="Manage contact points"
        />
        <div className={styles.separator} />
        <WelcomeCTABox
          title="Notification policies"
          description="Configure how firing alert instances are routed to contact points"
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
