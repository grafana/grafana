import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { isOpenSourceBuildOrUnlicenced } from 'app/features/admin/EnterpriseAuthFeaturesCard';

import AdCard, { AdCardProps } from './AdCard';

interface Props {
  cards: AdCardProps[];
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

  // Collect up to MAX_BEHIND cards that peek behind the top card
  const MAX_BEHIND = 2;
  const behindCards = Array.from({ length: Math.min(MAX_BEHIND, visible.length - 1) }, (_, depth) => {
    const idx = (clampedIndex + depth + 1) % visible.length;
    return visible[idx];
  });

  const goPrev = () => setActiveIndex((i) => (i - 1 + visible.length) % visible.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % visible.length);

  const handleDismiss = () => {
    setDismissedFlags((prev) => new Set([...prev, top.helpFlag]));
    // After dismissal the list shrinks; stay within bounds by not advancing
    setActiveIndex((i) => Math.max(0, i - 1 === -1 ? 0 : i));
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.getStack(behindCards.length)}>
        {/* Behind cards — rendered back-to-front so closer cards are on top */}
        {[...behindCards].reverse().map((card, reversedDepth) => {
          const depth = behindCards.length - 1 - reversedDepth;
          return (
            <div key={card.helpFlag} className={styles.getBehindCard(depth, behindCards.length)} aria-hidden>
              <AdCard {...card} />
            </div>
          );
        })}
        {/* Top card */}
        <div className={styles.topCard}>
          <AdCard {...top} onDismiss={handleDismiss} />
        </div>
      </div>

      {visible.length > 1 && (
        <div className={styles.nav}>
          <IconButton
            name="angle-left"
            size="md"
            onClick={goPrev}
            aria-label={t('alerting.single-stack.aria-label-previous-card', 'Previous card')}
            tooltip={t('alerting.single-stack.tooltip-previous', 'Previous')}
          />
          <span className={styles.counter}>
            <Trans i18nKey="alerting.ad-stack.counter" values={{ current: clampedIndex + 1, total: visible.length }}>
              {'{{current}} / {{total}}'}
            </Trans>
          </span>
          <IconButton
            name="angle-right"
            size="md"
            onClick={goNext}
            aria-label={t('alerting.single-stack.aria-label-next-card', 'Next card')}
            tooltip={t('alerting.single-stack.tooltip-next', 'Next')}
          />
        </div>
      )}
    </div>
  );
}

const MIN_CARD_WIDTH = 460;
const MAX_CARD_WIDTH = 600;

export function AdCardsStack({ cards }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const gapPx = parseInt(theme.spacing(2), 10);
  const [measureRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();

  // Shuffle once at this level so all stacks are drawn from a single shuffle
  const shuffled = useMemo(() => shuffle(cards), [cards]);

  if (!isOpenSourceBuildOrUnlicenced()) {
    return null;
  }

  // How many columns fit given the current container width?
  // Each column needs at least MIN_CARD_WIDTH px; columns are separated by gapPx.
  const numCols = containerWidth > 0 ? Math.max(1, Math.floor((containerWidth + gapPx) / (MIN_CARD_WIDTH + gapPx))) : 1;

  // Split shuffled cards into numCols stacks (round-robin distribution)
  const stacks: AdCardProps[][] = Array.from({ length: numCols }, () => []);
  shuffled.forEach((card, i) => stacks[i % numCols].push(card));

  return (
    <div
      ref={measureRef}
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${numCols}, minmax(0, ${MAX_CARD_WIDTH}px))` }}
    >
      {stacks.map(
        (stackCards) =>
          stackCards.length > 0 && (
            <SingleStack
              key={stackCards
                .map((c) => c.helpFlag)
                .sort()
                .join(',')}
              cards={stackCards}
            />
          )
      )}
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const getStyles = (theme: GrafanaTheme2) => {
  // How many px each successive behind card peeks out below the one in front of it
  const peekPx = 10;
  // How much each successive depth level shrinks
  const scaleStep = 0.04;

  return {
    grid: css({
      display: 'grid',
      gap: theme.spacing(2),
    }),

    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),

    // Reserves space for all peeking strips; numBehind drives total padding
    getStack: (numBehind: number) =>
      css({
        position: 'relative',
        paddingBottom: `${numBehind * peekPx}px`,
      }),

    topCard: css({
      position: 'relative',
      zIndex: 10,
    }),

    // depth=0 is directly behind the top card, depth=1 is furthest back.
    // Each level sits peekPx lower than the one in front, so strips cascade visually.
    // numBehind is the total number of behind cards (needed to compute bottom offset).
    getBehindCard: (depth: number, numBehind: number) =>
      css({
        position: 'absolute',
        // depth=0 peeks out 1×peekPx, depth=1 peeks out 2×peekPx, etc.
        bottom: `${(numBehind - 1 - depth) * peekPx}px`,
        left: 0,
        right: 0,
        zIndex: 10 - (depth + 1),
        transform: `scale(${1 - (depth + 1) * scaleStep})`,
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
