import { keyframes } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';

const ghostBlobFloat = keyframes({
  '0%, 100%': {
    transform: 'translate3d(0, 0, 0) scale(1)',
    backgroundPosition: '12% 28%, 84% 18%, 44% 82%',
  },
  '33%': {
    transform: 'translate3d(3.8%, -5.2%, 0) scale(1.08)',
    backgroundPosition: '24% 16%, 72% 38%, 58% 70%',
  },
  '66%': {
    transform: 'translate3d(-4.2%, 3.6%, 0) scale(0.92)',
    backgroundPosition: '36% 26%, 66% 68%, 24% 76%',
  },
});

const ghostBlobPulse = keyframes({
  '0%, 100%': {
    opacity: 0.42,
  },
  '50%': {
    opacity: 1.2,
  },
});

const GHOST_MOVE_DURATION_MS = 3000;
const GHOST_PULSE_DURATION_MS = 2400;
const GHOST_MOVE_DELAY_MS = -1200;
const GHOST_PULSE_DELAY_MS = -700;

function getGhostBlobColor(theme: GrafanaTheme2, amount: number): string {
  return `color-mix(in srgb, ${theme.colors.text.secondary} ${amount}%, transparent)`;
}

export interface GhostCardVisuals {
  ghostBackgroundColor: string;
  ghostBorderColor: string;
  ghostAnimations: string;
  ghostAnimationDelays: string;
  ghostBlobStrong: string;
  ghostBlobMedium: string;
  ghostBlobSoft: string;
  ghostBlobOpacity: number;
  ghostIconColor: string;
}

export function getGhostCardVisuals(theme: GrafanaTheme2): GhostCardVisuals {
  return {
    ghostBackgroundColor: `color-mix(in srgb, ${theme.colors.background.secondary} 72%, ${theme.colors.background.primary})`,
    ghostBorderColor: `color-mix(in srgb, ${theme.colors.border.medium} 85%, ${theme.colors.text.secondary})`,
    ghostAnimations: `${ghostBlobFloat} ${GHOST_MOVE_DURATION_MS}ms ease-in-out infinite, ${ghostBlobPulse} ${GHOST_PULSE_DURATION_MS}ms ease-in-out infinite`,
    ghostAnimationDelays: `${GHOST_MOVE_DELAY_MS}ms, ${GHOST_PULSE_DELAY_MS}ms`,
    ghostBlobStrong: getGhostBlobColor(theme, 34),
    ghostBlobMedium: getGhostBlobColor(theme, 24),
    ghostBlobSoft: getGhostBlobColor(theme, 17),
    ghostBlobOpacity: 0.96,
    ghostIconColor: theme.colors.text.secondary,
  };
}
