import { css, cx } from '@emotion/css';
import { useEffect, useLayoutEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Button, Grid, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useStoredBoolean } from 'app/core/hooks/useStoredBoolean';

import { RecommendationCard } from './RecommendationCard';
import { RecommendationExisting } from './RecommendationExisting';
import { RecommendationPill } from './RecommendationPill';
import { type RecommendationItem } from './types';

const HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY = 'grafana.home.recommendations.collapsed';

interface RecommendationsViewProps {
  recommendations: RecommendationItem[];
}

export function RecommendationsView({ recommendations }: RecommendationsViewProps) {
  const styles = useStyles2(getStyles);
  const [collapsed, setCollapsed] = useStoredBoolean(HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY, false);

  // Lazy-mount: a persisted collapsed preference must not fire the Kubernetes queries.
  // Once expanded, stay mounted so collapse/expand never refetches (hidden preserves state).
  const [cardsMounted, setCardsMounted] = useState(false);
  useLayoutEffect(() => {
    if (!collapsed) {
      setCardsMounted(true);
    }
  }, [collapsed]);

  // Anchored by id, not position: probes insert cards in priority order as they settle, and a
  // late earlier-ordered card must grow the deck without moving the slide the user is reading.
  const [activeId, setActiveId] = useState<string>();
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // First card while unanchored (mount, or the anchored card disappeared).
  const foundIndex = recommendations.findIndex((recommendation) => recommendation.id === activeId);
  const safeIndex = foundIndex === -1 ? 0 : foundIndex;
  const nextId = recommendations[(safeIndex + 1) % recommendations.length].id;

  // Capture the anchor as soon as a card is showing: without this, activeId stays undefined
  // until the first interaction and the displayed slide would still track position 0.
  const firstId = recommendations[0].id;
  useEffect(() => {
    if (foundIndex === -1) {
      setActiveId(firstId);
    }
  }, [foundIndex, firstId]);

  useEffect(() => {
    if (collapsed || paused) {
      return;
    }

    const timeout = setTimeout(() => {
      setActiveId(nextId);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [collapsed, paused, nextId]);

  return (
    <div>
      <Stack direction="row" alignItems="center" columnGap={2} rowGap={1} wrap="wrap">
        <Text element="h2" variant="h5">
          <Trans i18nKey="home.recommendations.title">Recommendations for your stack</Trans>
        </Text>

        {collapsed && (
          <div className={styles.pills}>
            <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
              {recommendations.map((recommendation) => (
                <RecommendationPill key={recommendation.id} recommendation={recommendation} />
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
          <Grid gap={0} columns={{ xs: 1, md: 2 }}>
            <div className={styles.card}>
              <RecommendationExisting />

              <div className={styles.arrow}>
                <Icon name="arrow-right" size="xl" />
              </div>
            </div>

            <div
              className={cx(styles.card, styles.recommended)}
              role="region"
              aria-roledescription={t('home.recommendations.carousel-roledescription', 'carousel')}
              aria-label={t('home.recommendations.carousel-label', 'Recommended apps')}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                <Badge color="brand" icon="bolt" text={t('home.recommendations.recommended', 'Recommended')} />

                <Stack direction="row" alignItems="center" gap={1}>
                  <Button
                    variant="secondary"
                    size="sm"
                    fill="text"
                    icon="angle-left"
                    onClick={() =>
                      setActiveId(recommendations[(safeIndex - 1 + recommendations.length) % recommendations.length].id)
                    }
                    aria-label={t('home.recommendations.previous', 'Previous')}
                  />

                  {recommendations.map((recommendation, i) =>
                    i === safeIndex ? (
                      <Button
                        key={recommendation.id}
                        variant="secondary"
                        size="sm"
                        fill="solid"
                        icon={paused ? 'play' : 'pause'}
                        onClick={() => setPaused(!paused)}
                        aria-label={
                          paused ? t('home.recommendations.resume', 'Resume') : t('home.recommendations.pause', 'Pause')
                        }
                        data-paused={paused ? true : undefined}
                        className={cx(styles.dot, styles.active)}
                      />
                    ) : (
                      <Button
                        key={recommendation.id}
                        variant="secondary"
                        size="sm"
                        fill="solid"
                        onClick={() => setActiveId(recommendation.id)}
                        aria-label={t('home.recommendations.go-to', 'Go to recommendation {{index}}', { index: i + 1 })}
                        className={styles.dot}
                      />
                    )
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    fill="text"
                    icon="angle-right"
                    onClick={() => setActiveId(nextId)}
                    aria-label={t('home.recommendations.next', 'Next')}
                  />
                </Stack>
              </Stack>

              <div className={styles.outer}>
                <div className={styles.inner} style={{ transform: `translateX(-${safeIndex * 100}%)` }}>
                  {recommendations.map((recommendation, i) => (
                    <div
                      key={recommendation.id}
                      className={styles.item}
                      aria-hidden={i !== safeIndex}
                      {...(i !== safeIndex && { inert: '' })}
                    >
                      <RecommendationCard recommendation={recommendation} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Grid>
        </div>
      )}
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
