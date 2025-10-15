import { keyframes } from '@emotion/css';

export const spin = keyframes({
  '0%': {
    transform: 'rotate(0deg)',
  },
  '100%': {
    transform: 'rotate(359deg)',
  },
});

// Gentle bounce animation inspired by Facebook's microinteractions
// Creates a playful, inviting feeling rather than aggressive pulsing
export const pulse = keyframes({
  '0%': {
    transform: 'scale(1)',
  },
  '15%': {
    transform: 'scale(1.08)', // Gentle anticipation
  },
  '30%': {
    transform: 'scale(0.98)', // Slight squash
  },
  '45%': {
    transform: 'scale(1.04)', // Bounce back
  },
  '60%': {
    transform: 'scale(1)', // Settle
  },
  '100%': {
    transform: 'scale(1)',
  },
});

// Shimmer/shine effect - light sweeps left to right
// Elegant and eye-catching without being distracting
export const shimmer = keyframes({
  '0%': {
    transform: 'translateX(-100%)',
  },
  '100%': {
    transform: 'translateX(100%)',
  },
});
