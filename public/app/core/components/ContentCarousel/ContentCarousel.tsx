import { css, cx } from '@emotion/css';
import { type ReactNode, useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack, useStyles2 } from '@grafana/ui';

export interface ContentCarouselProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Accessible name of the carousel region, e.g. "Recommended apps". */
  label: string;
  /** Content left of the controls, e.g. a badge or a heading. */
  header?: ReactNode;
  /** Accessible name of the control that shows the slide at 1-based `position`. */
  getSlideLabel?: (position: number) => string;
  /**
   * Advance to the next slide every `autoAdvanceMs` until the user pauses. Omitted, the carousel only moves
   * on user input and the pause control is not rendered. It starts paused when reduced motion is preferred.
   */
  autoAdvanceMs?: number;
  /** Stop advancing without changing the user's pause choice, e.g. while the carousel is hidden. */
  autoAdvanceSuspended?: boolean;
  /** Controlled index; pair with `onIndexChange`. Uncontrolled when omitted. */
  index?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
}

/**
 * One slide at a time with previous, next and per-slide controls, following the WAI-ARIA carousel pattern.
 * Slides fill the carousel's width; hidden slides are inert so focus never lands off-screen.
 */
export function ContentCarousel<T>({
  items,
  getKey,
  renderItem,
  label,
  header,
  getSlideLabel = (position) => t('content-carousel.go-to', 'Go to slide {{position}}', { position }),
  autoAdvanceMs,
  autoAdvanceSuspended = false,
  index: controlledIndex,
  onIndexChange,
  className,
}: ContentCarouselProps<T>) {
  const styles = useStyles2(getStyles);
  const [uncontrolledIndex, setUncontrolledIndex] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const index = controlledIndex ?? uncontrolledIndex;
  const setIndex = (next: number) => {
    setUncontrolledIndex(next);
    onIndexChange?.(next);
  };

  // Clamp during render so a shrinking list cannot select an undefined entry.
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  // A single slide needs no controls and must not auto-advance onto itself.
  const showControls = items.length > 1;
  const autoAdvances = autoAdvanceMs !== undefined;

  useEffect(() => {
    if (!autoAdvances || autoAdvanceSuspended || paused || !showControls) {
      return;
    }

    const timeout = setTimeout(() => {
      const next = (safeIndex + 1) % items.length;
      setUncontrolledIndex(next);
      onIndexChange?.(next);
    }, autoAdvanceMs);

    return () => clearTimeout(timeout);
  }, [autoAdvances, autoAdvanceMs, autoAdvanceSuspended, paused, showControls, safeIndex, items.length, onIndexChange]);

  return (
    <div
      className={cx(styles.carousel, className)}
      role="region"
      aria-roledescription={t('content-carousel.roledescription', 'carousel')}
      aria-label={label}
    >
      {(header || showControls) && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
          {header ?? <span />}

          {showControls && (
            <Stack direction="row" alignItems="center" gap={1}>
              <Button
                variant="secondary"
                size="sm"
                fill="text"
                icon="angle-left"
                onClick={() => setIndex((safeIndex - 1 + items.length) % items.length)}
                aria-label={t('content-carousel.previous', 'Previous')}
              />

              {items.map((item, i) =>
                i === safeIndex && autoAdvances ? (
                  <Button
                    key={getKey(item)}
                    variant="secondary"
                    size="sm"
                    fill="solid"
                    icon={paused ? 'play' : 'pause'}
                    onClick={() => setPaused(!paused)}
                    aria-label={paused ? t('content-carousel.resume', 'Resume') : t('content-carousel.pause', 'Pause')}
                    data-paused={paused ? true : undefined}
                    className={cx(styles.dot, styles.active, styles.toggle)}
                  />
                ) : (
                  <Button
                    key={getKey(item)}
                    variant="secondary"
                    size="sm"
                    fill="solid"
                    onClick={() => setIndex(i)}
                    aria-label={getSlideLabel(i + 1)}
                    aria-current={i === safeIndex ? 'true' : undefined}
                    className={cx(styles.dot, i === safeIndex && styles.active)}
                  />
                )
              )}

              <Button
                variant="secondary"
                size="sm"
                fill="text"
                icon="angle-right"
                onClick={() => setIndex((safeIndex + 1) % items.length)}
                aria-label={t('content-carousel.next', 'Next')}
              />
            </Stack>
          )}
        </Stack>
      )}

      <div className={styles.outer}>
        <div className={styles.inner} style={{ transform: `translateX(-${safeIndex * 100}%)` }}>
          {items.map((item, i) => (
            <div
              key={getKey(item)}
              className={styles.slide}
              role="group"
              aria-roledescription={t('content-carousel.slide-roledescription', 'slide')}
              aria-label={t('content-carousel.slide-label', '{{position}} of {{total}}', {
                position: i + 1,
                total: items.length,
              })}
              aria-hidden={i !== safeIndex}
              inert={i !== safeIndex}
            >
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  carousel: css({
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  }),
  dot: css({
    background: theme.colors.background.secondary,
    lineHeight: 0,
    padding: 0,
    width: theme.spacing(1),
    height: theme.spacing(1),
    borderRadius: theme.shape.radius.pill,
    position: 'relative',

    // Enlarge the hit area beyond the visible dot.
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
  }),
  // The active dot doubles as the pause control when the carousel auto-advances.
  toggle: css({
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
    // Fill the carousel so slide content can align to its bottom edge.
    height: '100%',

    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['transform']),
    },
  }),
  slide: css({
    display: 'flex',
    minWidth: '100%',
  }),
});
