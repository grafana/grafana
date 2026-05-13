import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { LinkButton, TextLink, useStyles2 } from '@grafana/ui';

const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';
const DOCS_URL = 'https://grafana.com/docs/plugins/grafana-assistant-app/latest/';
const BLOG_URL =
  'https://grafana.com/blog/2025/08/14/ai-for-grafana-onboarding-get-your-teams-started-quicker-with-grafana-assistant';
const VIDEO_URL = 'https://www.youtube.com/watch?v=UtZkFYUmjrM';
const SELF_MANAGED_DOCS_URL = 'https://grafana.com/docs/grafana-cloud/machine-learning/assistant/self-managed/';
const VIDEO_THUMB = 'https://img.youtube.com/vi/UtZkFYUmjrM/hqdefault.jpg';
const DOCS_THUMB = 'https://grafana.com/meta-generator/Grafana+Assistant@@@cloud@@@1.png';
const BLOG_THUMB = 'https://a-us.storyblok.com/f/1022730/1200x630/78f2b37ebc/onboarding-assistant-meta.png?w=1504';

export default function AssistantOnboardingPage() {
  const styles = useStyles2(getStyles);
  const installPath = `${config.appSubUrl}/plugins/${ASSISTANT_PLUGIN_ID}`;

  const onInstallClick = () => {
    reportInteraction('assistant_onboarding_install_clicked', {
      plugin_id: ASSISTANT_PLUGIN_ID,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.titleWithIcon}>
            <svg className={styles.sparkleIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" fill="currentColor" />
              <path
                d="M19 3L20.5 7.5L25 9L20.5 10.5L19 15L17.5 10.5L13 9L17.5 7.5L19 3Z"
                fill="currentColor"
                opacity="0.6"
              />
              <path
                d="M7 1L7.75 3.25L10 4L7.75 4.75L7 7L6.25 4.75L4 4L6.25 3.25L7 1Z"
                fill="currentColor"
                opacity="0.4"
              />
            </svg>
            <div className={styles.titleText}>
              <p className={styles.greeting}>
                <Trans i18nKey="assistant-onboarding.greeting">Hi, I&apos;m</Trans>
              </p>
              <h1 className={styles.title}>
                <Trans i18nKey="assistant-onboarding.heading">Grafana Assistant</Trans>
              </h1>
            </div>
          </div>

          <p className={styles.subtitle}>
            <Trans i18nKey="assistant-onboarding.subtitle">
              A purpose-built <span className={styles.magicText}>agentic LLM assistant</span> for Grafana that helps you
              learn, investigate, make changes and more.
            </Trans>
          </p>
        </header>

        <section className={styles.ctaSection}>
          <LinkButton href={installPath} icon="plus-circle" size="lg" variant="primary" onClick={onInstallClick}>
            <Trans i18nKey="assistant-onboarding.install-cta">Install Grafana Assistant</Trans>
          </LinkButton>
          <p className={styles.ctaSubnote}>
            <Trans i18nKey="assistant-onboarding.subnote">
              Once installed, connect it to Grafana Cloud to get started.
            </Trans>
          </p>
          <TextLink href={SELF_MANAGED_DOCS_URL} external>
            <Trans i18nKey="assistant-onboarding.learn-how">Learn how</Trans>
          </TextLink>
        </section>

        <section className={styles.learnMore}>
          <header className={styles.learnMoreHeader}>
            <h2 className={styles.learnMoreTitle}>
              <Trans i18nKey="assistant-onboarding.learn-more.title">Learn more</Trans>
            </h2>
            <p className={styles.learnMoreSubtitle}>
              <Trans i18nKey="assistant-onboarding.learn-more.subtitle">
                Explore tutorials, documentation, and best practices
              </Trans>
            </p>
          </header>

          <div className={styles.cards}>
            <ResourceCard
              styles={styles}
              iconColor="#3B82F6"
              icon={
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z"
                    fill="currentColor"
                  />
                  <path d="M8 12H16V14H8V12ZM8 16H13V18H8V16Z" fill="currentColor" />
                </svg>
              }
              title={t('assistant-onboarding.cards.docs.title', 'Documentation')}
              description={t(
                'assistant-onboarding.cards.docs.description',
                'Setup guide and feature reference for getting started'
              )}
              linkText={t('assistant-onboarding.cards.docs.link', 'Read docs')}
              href={DOCS_URL}
              thumbnail={DOCS_THUMB}
            />
            <ResourceCard
              styles={styles}
              iconColor="#F59E0B"
              icon={
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21 5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5ZM7 17V15H17V17H7ZM17 13H7V11H17V13ZM17 9H7V7H17V9Z"
                    fill="currentColor"
                  />
                </svg>
              }
              title={t('assistant-onboarding.cards.blog.title', 'Blog & use cases')}
              description={t(
                'assistant-onboarding.cards.blog.description',
                'Real-world examples and best practices for using Assistant'
              )}
              linkText={t('assistant-onboarding.cards.blog.link', 'Read blog')}
              href={BLOG_URL}
              thumbnail={BLOG_THUMB}
            />
            <ResourceCard
              styles={styles}
              iconColor="#EF4444"
              icon={
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5V19L19 12L8 5Z" fill="currentColor" />
                </svg>
              }
              title={t('assistant-onboarding.cards.video.title', 'Video demo')}
              description={t(
                'assistant-onboarding.cards.video.description',
                'Watch a walkthrough of key features and capabilities'
              )}
              linkText={t('assistant-onboarding.cards.video.link', 'Watch video')}
              href={VIDEO_URL}
              thumbnail={VIDEO_THUMB}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

interface ResourceCardProps {
  styles: ReturnType<typeof getStyles>;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  linkText: string;
  href: string;
  thumbnail: string;
}

function ResourceCard({ styles, iconColor, icon, title, description, linkText, href, thumbnail }: ResourceCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardIcon} style={{ backgroundColor: iconColor }}>
        {icon}
      </div>
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDescription}>{description}</p>
        <a href={href} target="_blank" rel="noreferrer" className={styles.cardLink}>
          {linkText}
        </a>
      </div>
      <a href={href} target="_blank" rel="noreferrer" className={styles.cardThumbnail} aria-hidden="true" tabIndex={-1}>
        <div className={styles.cardThumbnailImage} style={{ backgroundImage: `url(${thumbnail})` }} />
      </a>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    containerType: 'inline-size',
    padding: theme.spacing(2),
    alignItems: 'center',
    '@container (min-width: 624px)': {
      padding: theme.spacing(4),
    },
  }),
  content: css({
    maxWidth: '900px',
    width: '100%',
  }),
  header: css({
    textAlign: 'center',
    marginBottom: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
  }),
  titleWithIcon: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0),
  }),
  titleText: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }),
  greeting: css({
    fontSize: '1.2rem',
    color: theme.colors.text.secondary,
    marginBottom: 0,
  }),
  title: css({
    fontSize: '2.5rem',
    fontWeight: 600,
    color: theme.colors.text.primary,
    margin: 0,
    '@container (min-width: 624px)': {
      fontSize: '3rem',
    },
  }),
  sparkleIcon: css({
    width: '48px',
    height: '48px',
    color: theme.colors.text.primary,
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
    [theme.transitions.handleMotion('no-preference')]: {
      animation: 'sparkle 10s ease-in-out infinite',
    },
    '@keyframes sparkle': {
      '0%, 100%': {
        transform: 'rotate(0deg) scale(1)',
        opacity: 0.8,
      },
      '50%': {
        transform: 'rotate(5deg) scale(1.05)',
        opacity: 1,
      },
    },
  }),
  subtitle: css({
    fontSize: '1.25rem',
    color: theme.colors.text.secondary,
    lineHeight: 1.6,
    maxWidth: '700px',
    margin: '0 auto',
    padding: `0 ${theme.spacing(2)}`,
    '@container (min-width: 624px)': {
      fontSize: '1.5rem',
      padding: 0,
    },
  }),
  magicText: css({
    background: 'linear-gradient(45deg, #A855F7, #F97316, #A855F7, #F97316)',
    backgroundSize: '300% 300%',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 'bold',
    display: 'inline-block',
    [theme.transitions.handleMotion('no-preference')]: {
      animation: 'gradientShift 15s ease-in-out infinite',
    },
    '@keyframes gradientShift': {
      '0%, 100%': { backgroundPosition: '0% 50%' },
      '50%': { backgroundPosition: '100% 50%' },
    },
  }),
  ctaSection: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(8),
  }),
  ctaSubnote: css({
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
    margin: 0,
    textAlign: 'center',
    maxWidth: '480px',
  }),
  learnMore: css({
    padding: theme.spacing(2),
  }),
  learnMoreHeader: css({
    marginBottom: theme.spacing(3),
    textAlign: 'left',
  }),
  learnMoreTitle: css({
    fontSize: '28px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: `0 0 ${theme.spacing(1)} 0`,
    letterSpacing: '-0.02em',
  }),
  learnMoreSubtitle: css({
    fontSize: '16px',
    color: theme.colors.text.secondary,
    margin: 0,
    lineHeight: 1.5,
    maxWidth: '600px',
  }),
  cards: css({
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: theme.spacing(2),
    '@container (min-width: 768px)': {
      gap: theme.spacing(4),
    },
  }),
  card: css({
    padding: theme.spacing(4),
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    textAlign: 'left',
    boxShadow: `
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'all 0.3s ease',
    },
    display: 'flex',
    gap: theme.spacing(3),
    alignItems: 'flex-start',
    '&:hover': {
      boxShadow: `
        0 12px 40px rgba(0, 0, 0, 0.15),
        0 4px 16px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.15)
      `,
    },
  }),
  cardIcon: css({
    width: '56px',
    height: '56px',
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    flexShrink: 0,
    '& svg': {
      width: '28px',
      height: '28px',
    },
  }),
  cardContent: css({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  }),
  cardTitle: css({
    fontSize: '20px',
    fontWeight: 600,
    color: theme.colors.text.primary,
    margin: `0 0 ${theme.spacing(1)} 0`,
    letterSpacing: '-0.01em',
  }),
  cardDescription: css({
    fontSize: '15px',
    color: theme.colors.text.secondary,
    margin: `0 0 ${theme.spacing(2)} 0`,
    lineHeight: 1.5,
  }),
  cardLink: css({
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: theme.spacing(0.5, 1),
    color: theme.colors.text.link,
    border: `1px solid ${theme.colors.text.link}`,
    borderRadius: theme.shape.radius.default,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '12px',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'all 0.2s ease',
    },
    '&:hover': {
      backgroundColor: theme.colors.text.link,
      color: theme.colors.background.primary,
    },
  }),
  cardThumbnail: css({
    display: 'none',
    '@container (min-width: 640px)': {
      display: 'block',
      width: '120px',
      height: '70px',
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      flexShrink: 0,
    },
  }),
  cardThumbnailImage: css({
    width: '100%',
    height: '100%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }),
});
