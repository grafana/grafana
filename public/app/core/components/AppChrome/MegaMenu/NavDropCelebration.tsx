import { css, keyframes } from '@emotion/css';
import { useEffect, type CSSProperties } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

const SPARKLE_OFFSETS = [
  { x: -36, y: -28, delay: 0 },
  { x: 40, y: -24, delay: 0.05 },
  { x: -44, y: 8, delay: 0.1 },
  { x: 44, y: 12, delay: 0.08 },
  { x: -20, y: 32, delay: 0.12 },
  { x: 28, y: 28, delay: 0.06 },
  { x: 0, y: -40, delay: 0.04 },
  { x: -8, y: 36, delay: 0.14 },
] as const;

const CELEBRATION_DURATION_MS = 1400;

interface Props {
  top: number;
  onComplete: () => void;
}

export function NavDropCelebration({ top, onComplete }: Props) {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const timer = window.setTimeout(onComplete, CELEBRATION_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={styles.container} style={{ top }} aria-hidden data-testid="nav-drop-celebration">
      <span className={styles.unicorn} role="img" aria-label="">
        🦄
      </span>
      {SPARKLE_OFFSETS.map((offset, index) => (
        <Icon
          key={index}
          name="ai-sparkle"
          className={styles.sparkle}
          style={
            {
              '--sparkle-x': `${offset.x}px`,
              '--sparkle-y': `${offset.y}px`,
              '--sparkle-delay': `${offset.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

const unicornPop = keyframes({
  '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3) rotate(-20deg)' },
  '35%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1.15) rotate(8deg)' },
  '70%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(0deg)' },
  '100%': { opacity: 0, transform: 'translate(-50%, -60%) scale(0.85) rotate(5deg)' },
});

const sparkleBurst = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translate(calc(-50% + var(--sparkle-x) * 0.2), calc(-50% + var(--sparkle-y) * 0.2)) scale(0)',
  },
  '30%': {
    opacity: 1,
    transform: 'translate(calc(-50% + var(--sparkle-x)), calc(-50% + var(--sparkle-y))) scale(1.2)',
  },
  '100%': {
    opacity: 0,
    transform: 'translate(calc(-50% + var(--sparkle-x) * 1.15), calc(-50% + var(--sparkle-y) * 1.1)) scale(0.4)',
  },
});

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'absolute',
    left: '50%',
    width: 0,
    height: 0,
    zIndex: theme.zIndex.dropdown,
    pointerEvents: 'none',
    overflow: 'visible',

    '@media (prefers-reduced-motion: reduce)': {
      '& *': {
        animationDuration: '0.01ms !important',
      },
    },
  }),
  unicorn: css({
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: theme.typography.h1.fontSize,
    lineHeight: 1,
    animation: `${unicornPop} ${CELEBRATION_DURATION_MS}ms ease-out forwards`,
    filter: 'drop-shadow(0 2px 8px rgba(255, 105, 180, 0.45))',
  }),
  sparkle: css({
    position: 'absolute',
    left: 0,
    top: 0,
    color: theme.colors.warning.text,
    animation: `${sparkleBurst} ${CELEBRATION_DURATION_MS}ms ease-out forwards`,
    animationDelay: 'var(--sparkle-delay)',
  }),
});
