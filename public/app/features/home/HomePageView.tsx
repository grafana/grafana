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
    <Page navId="home" layout={PageLayoutType.Custom}>
      <div className={styles.scroller}>
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
        <div className={styles.page} data-testid="home-page-view">
          <PageView pageId={pageId} fit="content" />
        </div>
      </div>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // One scroll area for the header and the page. Pages that follow the host paint
  // `--grafana-page-background`, which is the canvas colour, so the header reads as part of the page.
  scroller: css({
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    background: theme.colors.background.canvas,
  }),
  // Full width with the page's own 16px gutter, so the greeting, the prompt and the page's cards
  // share one left and right edge.
  hero: css({
    containerType: 'inline-size',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    overflowWrap: 'anywhere',
    padding: theme.spacing(4, 2, 0),
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
  // A page fitted to its content overflows this box into the scroll area. An Assistant that cannot
  // fit pages fills the box instead, a screen tall, and scrolls the page inside it.
  page: css({
    height: '100%',
  }),
});
