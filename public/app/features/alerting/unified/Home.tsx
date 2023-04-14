import { css, cx } from '@emotion/css';
import React from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';

export default function Home() {
  const theme = useTheme2();
  const styles = useStyles2(getWelcomePageStyles);

  return (
    <AlertingPageWrapper pageId={config.featureToggles.topnav ? 'alerting' : 'alert-home'}>
      <div className={styles.grid}>
        <WelcomeHeader className={styles.ctaContainer} />
        <ContentBox className={styles.flowBlock}>
          <div>
            <h3>How it works</h3>
            <ul className={styles.list}>
              <li>
                Grafana alerting periodically queries data sources and evaluates the condition defined in the alert rule
              </li>
              <li>If the condition is breached, an alert instance fires</li>
              <li>Firing instances are routed to notification policies based on matching labels</li>
              <li>Notifications are sent out to the contact points specified in the notification policy</li>
            </ul>
          </div>
          <SVG
            src={`public/img/alerting/at_a_glance_${theme.name.toLowerCase()}.svg`}
            width={undefined}
            height={undefined}
          />
        </ContentBox>
        <ContentBox className={styles.gettingStartedBlock}>
          <h3>Get started</h3>
          <Stack direction="column" alignItems="space-between">
            <ul className={styles.list}>
              <li>
                <strong>Create an alert rule</strong> by adding queries and expressions from multiple data sources.
              </li>
              <li>
                <strong>Add labels</strong> to your alert rules{' '}
                <strong>to connect them to notification policies</strong>
              </li>
              <li>
                <strong>Configure contact points</strong> to define where to send your notifications to.
              </li>
              <li>
                <strong>Configure notification policies</strong> to route your alert instances to contact points.
              </li>
            </ul>
            <div>
              <ArrowLink href="https://grafana.com/docs/grafana/latest/alerting/" title="Read more in the Docs" />
            </div>
          </Stack>
        </ContentBox>
        <ContentBox className={styles.videoBlock}>
          <iframe
            title="Alerting - Introductory video"
            src="https://player.vimeo.com/video/720001629?h=c6c1732f92"
            width="960"
            height="540"
            allow="autoplay; fullscreen"
            allowFullScreen
            frameBorder="0"
            // This is necessary because color-scheme defined on :root has impact on iframe elements
            // More about how color-scheme works for iframes https://github.com/w3c/csswg-drafts/issues/4772
            // Summary: If the color scheme of an iframe differs from embedding document iframe gets an opaque canvas bg appropriate to its color scheme
            style={{ colorScheme: 'light dark' }}
          ></iframe>
        </ContentBox>
      </div>
    </AlertingPageWrapper>
  );
}

const getWelcomePageStyles = (theme: GrafanaTheme2) => ({
  grid: css`
    display: grid;
    grid-template-rows: min-content auto auto;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
    gap: ${theme.spacing(2)};
  `,
  ctaContainer: css`
    grid-column: 1 / span 5;
  `,
  flowBlock: css`
    grid-column: 1 / span 5;

    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing(1)};

    & > div {
      flex: 2;
      min-width: 350px;
    }
    & > svg {
      flex: 3;
      min-width: 500px;
    }
  `,
  videoBlock: css`
    grid-column: 3 / span 3;
    grid-row: 3 / span 1;

    // Video required
    position: relative;
    padding: 56.25% 0 0 0; /* 16:9 */

    iframe {
      position: absolute;
      top: ${theme.spacing(2)};
      left: ${theme.spacing(2)};
      width: calc(100% - ${theme.spacing(4)});
      height: calc(100% - ${theme.spacing(4)});
      border: none;
    }
  `,
  gettingStartedBlock: css`
    grid-column: 1 / span 2;
    justify-content: space-between;
  `,
  list: css`
    margin: ${theme.spacing(0, 2)};
    & > li {
      margin-bottom: ${theme.spacing(1)};
    }
  `,
});

function WelcomeHeader({ className }: { className?: string }) {
  const styles = useStyles2(getWelcomeHeaderStyles);

  return (
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
  );
}

const getWelcomeHeaderStyles = (theme: GrafanaTheme2) => ({
  ctaContainer: css`
    padding: ${theme.spacing(4, 2)};
    display: flex;
    gap: ${theme.spacing(4)};
    justify-content: space-between;
    flex-wrap: wrap;

    ${theme.breakpoints.down('lg')} {
      flex-direction: column;
    }
  `,

  separator: css`
    width: 1px;
    background-color: ${theme.colors.border.medium};

    ${theme.breakpoints.down('lg')} {
      display: none;
    }
  `,
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
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.desc}>{description}</div>
      <div className={styles.actionRow}>
        <a href={href} className={styles.link}>
          {hrefText}
        </a>
      </div>
    </div>
  );
}

const getWelcomeCTAButtonStyles = (theme: GrafanaTheme2) => ({
  container: css`
    flex: 1;
    min-width: 240px;
    display: grid;
    gap: ${theme.spacing(1)};
    grid-template-columns: min-content 1fr 1fr 1fr;
    grid-template-rows: min-content auto min-content;
  `,

  title: css`
    margin-bottom: 0;
    grid-column: 2 / span 3;
    grid-row: 1;
  `,

  desc: css`
    grid-column: 2 / span 3;
    grid-row: 2;
  `,

  actionRow: css`
    grid-column: 2 / span 3;
    grid-row: 3;
    max-width: 240px;
  `,

  link: css`
    color: ${theme.colors.text.link};
  `,
});

function ContentBox({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  const styles = useStyles2(getContentBoxStyles);

  return <div className={cx(styles.box, className)}>{children}</div>;
}

const getContentBoxStyles = (theme: GrafanaTheme2) => ({
  box: css`
    padding: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.borderRadius()};
  `,
});

function ArrowLink({ href, title }: { href: string; title: string }) {
  const styles = useStyles2(getArrowLinkStyles);

  return (
    <a href={href} className={styles.link} rel="noreferrer">
      {title} <Icon name="angle-right" size="xl" />
    </a>
  );
}

const getArrowLinkStyles = (theme: GrafanaTheme2) => ({
  link: css`
    display: block;
    color: ${theme.colors.text.link};
  `,
});
