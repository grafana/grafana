import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { isOpenSourceBuildOrUnlicenced } from 'app/features/admin/EnterpriseAuthFeaturesCard';

import AdCard, { AdCardProps } from './AdCard';

interface Props {
  cards: AdCardProps[];
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function SingleStack({ cards }: Props) {
  const styles = useStyles2(getStyles);

  // Shuffle once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffled = useMemo(() => shuffle(cards), []);

  // Pre-populate dismissed set from persisted helpFlags so dismissed cards never flash
  const [dismissedFlags, setDismissedFlags] = useState<Set<number>>(
    () => new Set(shuffled.filter((c) => Boolean(contextSrv.user.helpFlags1 & c.helpFlag)).map((c) => c.helpFlag))
  );

  const visible = shuffled.filter((c) => !dismissedFlags.has(c.helpFlag));

  // Active index into `visible`; clamp when cards get dismissed
  const [activeIndex, setActiveIndex] = useState(0);
  const clampedIndex = Math.min(activeIndex, Math.max(0, visible.length - 1));

  if (visible.length === 0) {
    return null;
  }

  const top = visible[clampedIndex];
  const behindIndex = (clampedIndex + 1) % visible.length;
  const behind = visible.length > 1 ? visible[behindIndex] : undefined;

  const goPrev = () => setActiveIndex((i) => (i - 1 + visible.length) % visible.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % visible.length);

  const handleDismiss = () => {
    setDismissedFlags((prev) => new Set([...prev, top.helpFlag]));
    // After dismissal the list shrinks; stay within bounds by not advancing
    setActiveIndex((i) => Math.max(0, i - 1 === -1 ? 0 : i));
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.stack}>
        {/* Behind card — peek strip only */}
        {behind && (
          <div className={styles.behindCard} aria-hidden>
            <AdCard {...behind} />
          </div>
        )}
        {/* Top card */}
        <div className={styles.topCard}>
          <AdCard {...top} onDismiss={handleDismiss} />
        </div>
      </div>

      {visible.length > 1 && (
        <div className={styles.nav}>
          <IconButton name="angle-left" size="md" onClick={goPrev} aria-label="Previous card" tooltip="Previous" />
          <span className={styles.counter}>
            <Trans i18nKey="alerting.ad-stack.counter" values={{ current: clampedIndex + 1, total: visible.length }}>
              {'{{current}} / {{total}}'}
            </Trans>
          </span>
          <IconButton name="angle-right" size="md" onClick={goNext} aria-label="Next card" tooltip="Next" />
        </div>
      )}
    </div>
  );
}

export function AdCardsStack({ cards }: Props) {
  const styles = useStyles2(getStyles);

  // Shuffle once at this level so the two halves are drawn from a single shuffle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffled = useMemo(() => shuffle(cards), []);

  if (!isOpenSourceBuildOrUnlicenced()) {
    return null;
  }

  const mid = Math.ceil(shuffled.length / 2);
  const leftCards = shuffled.slice(0, mid);
  const rightCards = shuffled.slice(mid);

  return (
    <div className={styles.twoCol}>
      <SingleStack cards={leftCards} />
      {rightCards.length > 0 && <SingleStack cards={rightCards} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  // How many px of the behind card peek out below the top card
  const peekPx = 12;
  // Uniform scale of the behind card (makes it visually smaller/further away)
  const behindScale = 0.95;

  return {
    twoCol: css({
      display: 'grid',
      gap: theme.spacing(2),
      gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
    }),

    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),

    // Reserves space for the peeking strip beneath the top card
    stack: css({
      position: 'relative',
      paddingBottom: `${peekPx}px`,
    }),

    topCard: css({
      position: 'relative',
      zIndex: 2,
    }),

    // Full card rendered behind the top card. Positioned absolutely so its
    // bottom edge sits at the container's bottom edge (peekPx below the top card).
    // z-index keeps it under the top card; no clipping needed — the top card
    // naturally covers all but the peeking bottom strip.
    behindCard: css({
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      transform: `scale(${behindScale})`,
      transformOrigin: 'bottom center',
      pointerEvents: 'none',
    }),

    nav: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing(1),
    }),

    counter: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      minWidth: '3ch',
      textAlign: 'center',
    }),
  };
};
