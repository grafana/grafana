import { css, keyframes } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { useTheme2 } from '@grafana/ui';

type SparkJoyWaveProps = {
  active: boolean;
  durationMs?: number;
  zIndex?: number;
};

// Diagonal sweep animation moving a large rotated plane across the viewport
const sweep = keyframes({
  from: {
    transform: 'rotate(25deg) translate3d(-120%, 0, 0)',
  },
  to: {
    transform: 'rotate(25deg) translate3d(120%, 0, 0)',
  },
});

// Subtle background shimmer
const shimmer = keyframes({
  from: {
    backgroundPosition: '0 0, 40px 40px, 0 0',
  },
  to: {
    backgroundPosition: '80px 80px, 0 0, 200% 0',
  },
});

export function SparkJoyWave({ active, durationMs = 2400, zIndex = 9999 }: SparkJoyWaveProps) {
  const [visible, setVisible] = useState(false);
  const prevActive = useRef<boolean>(false);
  const firstRender = useRef<boolean>(true);
  const timeoutRef = useRef<number | undefined>(undefined);
  const theme = useTheme2();

  useEffect(() => {
    // Skip triggering on initial mount regardless of the stored value
    if (firstRender.current) {
      firstRender.current = false;
      prevActive.current = active;
      return () => {
        window.clearTimeout(timeoutRef.current);
      };
    }

    const turnedOn = !prevActive.current && active;
    prevActive.current = active;

    if (turnedOn) {
      setVisible(true);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setVisible(false), durationMs);
    }

    return () => {
      window.clearTimeout(timeoutRef.current);
    };
  }, [active, durationMs]);

  if (!visible) {
    return null;
  }

  const container = css({
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex,
  });

  // Large rotated plane that sweeps across the screen
  // Uses layered backgrounds: two dotted fields + a soft linear shimmer
  const plane = css({
    position: 'absolute',
    top: '-50vh',
    left: '-50vw',
    width: '200vw',
    height: '200vh',
    opacity: 0.7,
    // Three layers:
    // 1) Fine sparkle grid
    // 2) Coarser sparkle grid, offset
    // 3) Soft white shimmer band to emphasize the wipe
    backgroundImage:
      'radial-gradient(circle, rgba(255,255,255,0.9) 0 1.2px, rgba(255,255,255,0) 1.2px),' +
      'radial-gradient(circle, rgba(255,255,255,0.6) 0 1.6px, rgba(255,255,255,0) 1.6px),' +
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
    backgroundSize: '80px 80px, 120px 120px, 30% 100%',
    backgroundPosition: '0 0, 40px 40px, -50% 0',
    filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.35))',
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${sweep} ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1) forwards, ${shimmer} ${Math.round(
        durationMs * 0.9
      )}ms linear forwards`,
    },
  });

  return (
    <div className={container}>
      <div className={plane} />
    </div>
  );
}

export default SparkJoyWave;
