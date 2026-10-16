import { css, cx } from '@emotion/css';
import { useEffect, useLayoutEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { ContentCarousel } from 'app/core/components/ContentCarousel/ContentCarousel';

import { HomeGrid } from '../HomeGrid';
import { recommendationsShown } from '../analytics/main';
import { type Solution, type SolutionId } from '../solutions/types';

import { RecommendationCard } from './RecommendationCard';
import { RecommendationExisting } from './RecommendationExisting';
import { RecommendationPill } from './RecommendationPill';
import { type BaseRow } from './solutionsMatrix';
import { type RecommendationItem } from './types';

const AUTO_ADVANCE_MS = 5000;

interface RecommendationsViewProps {
  recommendations: RecommendationItem[];
  /** The same recommendations reordered per solution view; keyed by solution id. */
  recommendationsBySolution: Record<SolutionId, RecommendationItem[]>;
  /** Matrix row that drove the selection; threaded into cta_clicked as starting_state. */
  startingState: BaseRow;
  /** Owned by the parent: the stored preference also gates recommendation selection there. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  solutions: Solution[];
}

export function RecommendationsView({
  recommendations,
  recommendationsBySolution,
  startingState,
  collapsed,
  setCollapsed,
  solutions,
}: RecommendationsViewProps) {
  const styles = useStyles2(getStyles);

  // Lazy-mount: a persisted collapsed preference must not fire the Kubernetes queries.
  // Once expanded, stay mounted so collapse/expand never refetches (hidden preserves state).
  const [cardsMounted, setCardsMounted] = useState(false);
  useLayoutEffect(() => {
    if (!collapsed) {
      setCardsMounted(true);
    }
  }, [collapsed]);

  const [index, setIndex] = useState(0);

  // The carousel follows the solution displayed on the left card (default selection included);
  // undefined = providers still settling (skeleton holds the column), null = settled with none
  // (the global matrix order stands).
  const [activeSolution, setActiveSolution] = useState<SolutionId | null>();
  const selectionPending = activeSolution === undefined;
  const items = activeSolution != null ? recommendationsBySolution[activeSolution] : recommendations;

  // A solution switch restarts the carousel; layout effect so the reset lands in the same
  // pre-paint pass as the selection commit and the new order never flashes at the old index.
  useLayoutEffect(() => {
    setIndex(0);
  }, [activeSolution]);

  const hasRecommendations = items.length > 0;

  useEffect(() => {
    if (items.length && !selectionPending) {
      recommendationsShown({
        recommendation_ids: items.map((recommendation) => recommendation.id),
        starting_state: startingState,
        solution: activeSolution ?? undefined,
      });
    }
  }, [items, selectionPending, startingState, activeSolution]);

  return (
    <div>
      <Stack direction="row" alignItems="center" columnGap={2} rowGap={1} wrap="wrap">
        <Text element="h2" variant="h5">
          <Trans i18nKey="home.recommendations.title">Recommendations for your stack</Trans>
        </Text>

        {collapsed && hasRecommendations && !selectionPending && (
          <div className={styles.pills}>
            <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
              {items.map((recommendation) => (
                <RecommendationPill
                  key={recommendation.id}
                  recommendation={recommendation}
                  startingState={startingState}
                  solution={activeSolution ?? undefined}
                />
              ))}
            </Stack>
          </div>
        )}

        <Stack direction="row" alignItems="center" gap={1} flex="1 1 auto">
          <div className={cx(styles.spacer, collapsed && styles.line)} />

          <Button
            variant="secondary"
            size="sm"
            fill="text"
            icon={collapsed ? 'angle-down' : 'angle-up'}
            iconPlacement="right"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <Trans i18nKey="home.recommendations.show">Show</Trans>
            ) : (
              <Trans i18nKey="home.recommendations.hide">Hide</Trans>
            )}
          </Button>
        </Stack>
      </Stack>

      {cardsMounted && (
        <div className={styles.cards} hidden={collapsed}>
          <HomeGrid columns={hasRecommendations ? 2 : 1} gap={0}>
            <div className={styles.card}>
              <RecommendationExisting onSelectionChange={setActiveSolution} solutions={solutions} />

              {hasRecommendations && (
                <div className={styles.arrow}>
                  <Icon name="arrow-right" size="xl" />
                </div>
              )}
            </div>

            {hasRecommendations &&
              (selectionPending ? (
                <RecommendedCardSkeleton />
              ) : (
                <ContentCarousel
                  className={cx(styles.card, styles.recommended)}
                  label={t('home.recommendations.carousel-label', 'Recommended apps')}
                  header={
                    <Badge color="brand" icon="bolt" text={t('home.recommendations.recommended', 'Recommended')} />
                  }
                  getSlideLabel={(index) =>
                    t('home.recommendations.go-to', 'Go to recommendation {{index}}', { index })
                  }
                  items={items}
                  getKey={(recommendation) => recommendation.id}
                  renderItem={(recommendation) => (
                    <RecommendationCard
                      recommendation={recommendation}
                      startingState={startingState}
                      solution={activeSolution ?? undefined}
                    />
                  )}
                  autoAdvanceMs={AUTO_ADVANCE_MS}
                  autoAdvanceSuspended={collapsed}
                  index={index}
                  onIndexChange={setIndex}
                />
              ))}
          </HomeGrid>
        </div>
      )}
    </div>
  );
}

// Mirrors the recommended-card shell while the default solution settles; the carousel must not
// paint an order the settling selection would immediately reorder.
function RecommendedCardSkeleton() {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.card, styles.recommended)} data-testid="recommended-card-skeleton">
      <Stack direction="column" gap={2}>
        <Skeleton width={120} height={22} />
        <Skeleton width={240} height={30} />
        <Skeleton height={20} />
        <Skeleton width={170} height={32} />
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The pills, header line and arrow flip with the recommendations HomeGrid at the page's md breakpoint.
  pills: css({
    [theme.breakpoints.container.down('md', 'page')]: {
      order: 1,
    },
  }),
  spacer: css({
    flex: '1 1 0%',
  }),
  line: css({
    [theme.breakpoints.container.up('md', 'page')]: {
      background: theme.colors.border.medium,
      height: '1px',
    },
  }),
  cards: css({
    background: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    margin: theme.spacing(2, 0, 0),
    overflow: 'hidden',
  }),
  card: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(3, 4),
    position: 'relative',
    minWidth: 0,
  }),
  recommended: css({
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background: theme.colors.gradients.brandHorizontal,
      opacity: 0.05,
      pointerEvents: 'none',
    },
  }),
  arrow: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.circle,
    border: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(0.25),
    lineHeight: 0,
    position: 'absolute',
    zIndex: 1,
    left: '50%',
    top: '100%',
    transform: 'translate(-50%, -50%) rotate(90deg)',

    [theme.breakpoints.container.up('md', 'page')]: {
      top: theme.spacing(2),
      left: '100%',
      transform: 'translate(-50%, 0)',
    },
  }),
});
