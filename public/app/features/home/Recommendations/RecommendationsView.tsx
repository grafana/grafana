import { css, cx } from '@emotion/css';
import { useEffect, useLayoutEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Button, Grid, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { RecommendationCard } from './RecommendationCard';
import { RecommendationExisting } from './RecommendationExisting';
import { RecommendationPill } from './RecommendationPill';
import { type BaseRow, type ExistingSolutionId } from './solutionsMatrix';
import { type RecommendationItem } from './types';

interface RecommendationsViewProps {
  recommendations: RecommendationItem[];
  /** The same recommendations reordered per solution view; keyed by ExistingItem id. */
  recommendationsBySolution: Record<ExistingSolutionId, RecommendationItem[]>;
  /** Matrix row that drove the selection; threaded into cta_clicked as starting_state. */
  startingState: BaseRow;
  /** Owned by the parent: the stored preference also gates the solution probes there. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function RecommendationsView({
  recommendations,
  recommendationsBySolution,
  startingState,
  collapsed,
  setCollapsed,
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
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // The carousel follows the solution displayed on the left card (default selection included);
  // undefined = providers still settling (skeleton holds the column), null = settled with none
  // (the global matrix order stands).
  const [activeSolution, setActiveSolution] = useState<ExistingSolutionId | null>();
  const selectionPending = activeSolution === undefined;
  const items = activeSolution != null ? recommendationsBySolution[activeSolution] : recommendations;

  // A solution switch restarts the carousel: the point of the swap is the new leading card.
  useEffect(() => {
    setIndex(0);
  }, [activeSolution]);

  // Clamp during render so a shrinking list cannot select an undefined entry.
  const safeIndex = Math.min(index, items.length - 1);
  const hasRecommendations = items.length > 0;
  // A single card needs no carousel controls and must not auto-advance onto itself.
  const showControls = items.length > 1;

  useEffect(() => {
    if (collapsed || paused || !showControls || selectionPending) {
      return;
    }

    const timeout = setTimeout(() => {
      setIndex((safeIndex + 1) % items.length);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [collapsed, paused, safeIndex, items.length, showControls, selectionPending]);

  return (
    <div>
      <Stack direction="row" alignItems="center" columnGap={2} rowGap={1} wrap="wrap">
        <Text element="h2" variant="h5">
          <Trans i18nKey="home.recommendations.title">Recommendations for your stack</Trans>
        </Text>

        {collapsed && hasRecommendations && (
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
          <Grid gap={0} columns={hasRecommendations ? { xs: 1, md: 2 } : 1}>
            <div className={styles.card}>
              <RecommendationExisting onSelectionChange={setActiveSolution} />

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
                <div
                  className={cx(styles.card, styles.recommended)}
                  role="region"
                  aria-roledescription={t('home.recommendations.carousel-roledescription', 'carousel')}
                  aria-label={t('home.recommendations.carousel-label', 'Recommended apps')}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                    <Badge color="brand" icon="bolt" text={t('home.recommendations.recommended', 'Recommended')} />

                    {showControls && (
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Button
                          variant="secondary"
                          size="sm"
                          fill="text"
                          icon="angle-left"
                          onClick={() => setIndex((safeIndex - 1 + items.length) % items.length)}
                          aria-label={t('home.recommendations.previous', 'Previous')}
                        />

                        {items.map((_, i) =>
                          i === safeIndex ? (
                            <Button
                              key={i}
                              variant="secondary"
                              size="sm"
                              fill="solid"
                              icon={paused ? 'play' : 'pause'}
                              onClick={() => setPaused(!paused)}
                              aria-label={
                                paused
                                  ? t('home.recommendations.resume', 'Resume')
                                  : t('home.recommendations.pause', 'Pause')
                              }
                              data-paused={paused ? true : undefined}
                              className={cx(styles.dot, styles.active)}
                            />
                          ) : (
                            <Button
                              key={i}
                              variant="secondary"
                              size="sm"
                              fill="solid"
                              onClick={() => setIndex(i)}
                              aria-label={t('home.recommendations.go-to', 'Go to recommendation {{index}}', {
                                index: i + 1,
                              })}
                              className={styles.dot}
                            />
                          )
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          fill="text"
                          icon="angle-right"
                          onClick={() => setIndex((safeIndex + 1) % items.length)}
                          aria-label={t('home.recommendations.next', 'Next')}
                        />
                      </Stack>
                    )}
                  </Stack>

                  <div className={styles.outer}>
                    <div className={styles.inner} style={{ transform: `translateX(-${safeIndex * 100}%)` }}>
                      {items.map((recommendation, i) => (
                        <div
                          key={recommendation.id}
                          className={styles.item}
                          aria-hidden={i !== safeIndex}
                          {...(i !== safeIndex && { inert: '' })}
                        >
                          <RecommendationCard
                            recommendation={recommendation}
                            startingState={startingState}
                            solution={activeSolution ?? undefined}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </Grid>
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
  pills: css({
    [theme.breakpoints.down('md')]: {
      order: 1,
    },
  }),
  spacer: css({
    flex: '1 1 0%',
  }),
  line: css({
    [theme.breakpoints.up('md')]: {
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

    [theme.breakpoints.up('md')]: {
      top: theme.spacing(2),
      left: '100%',
      transform: 'translate(-50%, 0)',
    },
  }),
  dot: css({
    background: theme.colors.background.secondary,
    lineHeight: 0,
    padding: 0,
    width: theme.spacing(1),
    height: theme.spacing(1),
    borderRadius: theme.shape.radius.pill,
    position: 'relative',

    '&::after': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: theme.spacing(2),
      height: theme.spacing(2),
    },

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['background-color', 'width', 'height'], {
        duration: theme.transitions.duration.short,
      }),
    },
  }),
  active: css({
    '&, &::after': {
      width: theme.spacing(3),
    },

    '&, &:hover, &:focus': {
      background: theme.colors.text.maxContrast,
      color: theme.colors.background.secondary,
    },

    '&:hover, &[data-paused]': {
      height: theme.spacing(2),
    },

    '& > svg': {
      margin: '0 auto',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity'], {
          duration: theme.transitions.duration.short,
        }),
      },
    },

    '&:not(:hover):not([data-paused])': {
      '& > svg': {
        opacity: 0,
      },
    },
  }),
  outer: css({
    overflow: 'hidden',
    flex: 1,
    margin: theme.spacing(2, 0, 0),
  }),
  inner: css({
    display: 'flex',
    // Fill the card cell so its CTA stays bottom-aligned with the existing card.
    height: '100%',

    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['transform']),
    },
  }),
  item: css({
    display: 'flex',
    minWidth: '100%',
  }),
});
