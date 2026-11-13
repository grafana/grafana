import { css } from '@emotion/css';
import { lazy, Suspense } from 'react';

import { type GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { PageLoader, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';

import { AssistantInputSlot } from './AssistantInputSlot';
import { PAGE_VIEW_COMPONENT_ID } from './homePageRef';
import useHomeGreeting from './useHomeGreeting';

const HomePage = lazy(() => import(/* webpackChunkName: "HomePage" */ './HomePage'));

interface PageViewProps {
  /** A page UUID, or the `<slug>-<12 hex>` reference the Assistant puts in page URLs. */
  pageId: string;
  /** `content` sizes the page to its content, so this view's scroll area scrolls it with the header. */
  fit?: 'container' | 'content';
}

/** The name to greet: the first word of the display name, falling back to the login. */
function getFirstName() {
  const { name, login } = contextSrv.user;
  return name?.trim().split(/\s+/)[0] || login;
}

/**
 * Renders a Grafana Page in place of the homepage, under a greeting and the Assistant's prompt.
 * The Assistant owns the page and its loading and access states; without the Assistant there is
 * nothing to render it with, so the default homepage takes over.
 */
export function HomePageView({ pageId }: Pick<PageViewProps, 'pageId'>) {
  const styles = useStyles2(getStyles);
  const greeting = useHomeGreeting(getFirstName());
  const { component: PageView, isLoading } = usePluginComponent<PageViewProps>(PAGE_VIEW_COMPONENT_ID);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!PageView) {
    return (
      <Suspense fallback={<PageLoader />}>
        <HomePage />
      </Suspense>
    );
  }

  return (
    <Page navId="home" layout={PageLayoutType.Custom} background="canvas">
      <div className={styles.hero}>
        <h1 className={styles.title}>{greeting}</h1>
        <p className={styles.summary}>
          <Trans i18nKey="home.page-view.summary">
            <strong>Ask me anything</strong>, or tell me how you want to <strong>change your home page</strong>.
          </Trans>
        </p>
        <div className={styles.composer}>
          <AssistantInputSlot framed={false} />
        </div>
      </div>
      <hr className={styles.divider} />
      <div className={styles.page} data-testid="home-page-view">
        <PageView pageId={pageId} fit="content" />
      </div>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The page draws its cards 16px inside its frame, so the header sits that much further in than
  // the page's box to share their left and right edge.
  hero: css({
    containerType: 'inline-size',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    overflowWrap: 'anywhere',
    padding: theme.spacing(5, 6, 4),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(4, 3, 3),
    },
  }),
  title: css({
    margin: 0,
    color: theme.colors.text.maxContrast,
    // Scales with the available width, including when a sidebar narrows it.
    fontSize: 'clamp(28px, 6cqi, 40px)',
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1.2,
    letterSpacing: '-0.03em',
  }),
  summary: css({
    margin: 0,
    maxWidth: 710,
    textWrap: 'pretty',
    color: theme.colors.text.secondary,
    fontSize: 'clamp(15px, 3cqi, 18px)',
    fontWeight: theme.typography.fontWeightLight,
    lineHeight: 28 / 18,
    strong: {
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
    },
  }),
  composer: css({
    marginTop: theme.spacing(2),
  }),
  divider: css({
    margin: theme.spacing(0, 6),
    border: 0,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 3),
    },
  }),
  // Grafana's page container scrolls the header and the page together; the page is fitted to its
  // content, so it never scrolls on its own. An Assistant that cannot fit pages fills this box, a
  // screen tall, and scrolls inside it instead.
  page: css({
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    padding: theme.spacing(2, 4, 0),
    '& > *': {
      flex: 1,
    },
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1, 1, 0),
    },
  }),
});
