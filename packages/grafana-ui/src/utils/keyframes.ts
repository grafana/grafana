import { keyframes } from '@emotion/css';

export const spin = keyframes({
  '0%': {
    transform: 'rotate(0deg)',
  },
  '100%': {
    transform: 'rotate(359deg)',
  },
});

// Shimmer/shine effect - light sweeps left to right
// Elegant and eye-catching without being distracting
export const shimmer = keyframes({
  '0%': {
    transform: 'translateX(-100%)',
  },
  '100%': {
    transform: 'translateX(200%)',
  },
});
