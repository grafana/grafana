import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Stack } from '@grafana/experimental';
import { Icon, LinkButton, useStyles2, useTheme2 } from '@grafana/ui/src';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';

export default function Home() {
  const theme = useTheme2();
  const styles = useStyles2(getWelcomePageStyles);

  return (
    <AlertingPageWrapper pageId="alert-list">
      <div className={styles.grid}>
        <WelcomeHeader className={styles.ctaContainer} />
        <ContextBox className={styles.flowBlock}>
          <img
            src={`public/img/alerting/notification_policy_${theme.name.toLowerCase()}.svg`}
            alt="Alerting flow chart"
          />
        </ContextBox>
        <ContextBox className={styles.videoBlock}>
          <iframe
            title="Alerting - Introductory video"
            src="https://player.vimeo.com/video/720001629"
            width="560"
            height="349"
            allow="autoplay; fullscreen"
            allowFullScreen
          ></iframe>
        </ContextBox>
        <ContextBox title="Getting started" className={styles.gettingStartedBlock}>
          <ul>
            <li>Create alert rules for your data sources</li>
            <li>Assign label to your alerts to give them context and meaning</li>
            <li>Configure where to send your alerts based on assigned labels</li>
            <li>Send notifications to tools you use like Slack, MS Teams, PagerDuty, OpsGenie and more</li>
          </ul>
          <ArrowLink href="https://grafana.com/docs/grafana/latest/alerting/" title="Read more in the Alerting Docs" />
        </ContextBox>
        <ContextBox title="Deep dive into alerting" className={styles.universityBlock}>
          To find out more you can enroll to our Alerting Grafana University course
          <ArrowLink
            href="https://university.grafana.com//lms/index.php?r=coursepath/deeplink&id_path=42&hash=caa235c6321f80e03df017ae9ec6eed5c79da9ec"
            title="Learn more in Grafana University course"
          />
        </ContextBox>
      </div>
    </AlertingPageWrapper>
  );
}

const getWelcomePageStyles = (theme: GrafanaTheme2) => ({
  grid: css`
    display: grid;
    grid-template-rows: min-content auto auto;
    grid-template-columns: min-content 1fr 1fr 1fr 1fr;
    gap: ${theme.spacing(2)};
  `,
  ctaContainer: css`
    grid-column: 1 / span 5;
  `,
  flowBlock: css`
    grid-row: 2 / span 2;
  `,
  videoBlock: css`
    grid-column: 2 / span 4;
    position: relative;
    padding-bottom: 56.25%; /* 16:9 */
    height: 0;

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
    grid-column: span 2;
    list-style-position: inside;
  `,
  universityBlock: css`
    grid-column: span 2;
  `,
});

function WelcomeHeader({ className }: { className?: string }) {
  const styles = useStyles2(getWelcomeHeaderStyles);

  return (
    <div className={cx(styles.container, className)}>
      <h2>What you can do</h2>
      <ArrowLink href="https://grafana.com/docs/grafana/latest/alerting/" title="Read more in the Alerting Docs" />

      <div className={styles.ctaContainer}>
        <WelcomeCTABox
          title="Manage alert rules"
          description="Manage your alert rules. Combine data from multiple data sources"
          icon="list-ul"
          href="/alerting/new"
          hrefText="Create a rule"
        />
        <WelcomeCTABox
          title="Manage notification policies"
          description="Configure where your alerts are delivered"
          icon="sitemap"
          href="/alerting/routes"
          hrefText="Check configuration"
        />
        <WelcomeCTABox
          title="Manage contact points"
          description="Configure who and how receives notifications"
          icon="comment-alt-share"
          href="/alerting/notifications"
          hrefText="Configure contact points"
        />
      </div>
    </div>
  );
}

const getWelcomeHeaderStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    padding: ${theme.spacing(4)};
    background-image: linear-gradient(
      325deg,
      hsl(36deg 96% 66%) 0%,
      hsl(29deg 96% 66%) 52%,
      hsl(21deg 96% 66%) 77%,
      hsl(10deg 90% 67%) 91%,
      hsl(356deg 76% 68%) 99%,
      hsl(341deg 61% 69%) 100%
    );
  `,
  ctaContainer: css`
    padding: ${theme.spacing(4)};
    display: flex;
    gap: ${theme.spacing(4)};
    justify-content: space-between;
    flex-wrap: wrap;
  `,
});

interface WelcomeCTABoxProps {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  href: string;
  hrefText: string;
}

function WelcomeCTABox({ title, description, icon, href, hrefText }: WelcomeCTABoxProps) {
  const styles = useStyles2(getWelcomeCTAButtonStyles);

  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <Icon name={icon} size="xxl" />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.desc}>{description}</div>
      <LinkButton href={href} className={styles.actionButton}>
        {hrefText}
      </LinkButton>
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
    grid-column: 2 / span 3;
    grid-row: 1;
  `,

  desc: css`
    grid-column: 2 / span 3;
    grid-row: 2;
  `,

  actionButton: css`
    grid-column: 2 / span 3;
    grid-row: 3;
    max-width: 240px;
  `,

  icon: css`
    grid-column: 1;
    grid-row: 1 / span 2;
    margin: auto;
  `,
});

function ContextBox({ children, title, className }: React.PropsWithChildren<{ title?: string; className?: string }>) {
  const styles = useStyles2(getContentBoxStyles);

  return (
    <div className={cx(styles.box, className)}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

const getContentBoxStyles = (theme: GrafanaTheme2) => ({
  box: css`
    padding: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
  `,
});

function ArrowLink({ href, title }: { href: string; title: string }) {
  const styles = useStyles2(getArrowLinkStyles);

  return (
    <a href={href} className={styles.link}>
      {title} <Icon name="angle-right" size="xl" className={styles.arrow} />
    </a>
  );
}

const getArrowLinkStyles = (theme: GrafanaTheme2) => ({
  link: css`
    display: block;
    color: ${theme.colors.text.link};
  `,
  arrow: css`
    //vertical-align: top;
  `,
});
