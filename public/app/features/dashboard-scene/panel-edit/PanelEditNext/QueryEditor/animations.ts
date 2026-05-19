import { keyframes } from '@emotion/css';

// Attention-grabbing entrance with an overshoot. Used by the header
// "Experimental feature options" button where it appears once after a
// dismissed banner — the bounce draws the eye.
export const slideInAndPulse = keyframes({
  '0%': { opacity: 0, transform: 'translateX(24px) scale(0.6)' },
  '60%': { opacity: 1, transform: 'translateX(0) scale(1.2)' },
  '80%': { transform: 'translateX(0) scale(0.9)' },
  '100%': { opacity: 1, transform: 'translateX(0) scale(1)' },
});

// Small fade-and-slide pair for elements that pop in/out next to existing
// content (the multi-select checkbox). 24px is a slot-sized nudge; the
// element's overflow-hidden parent does most of the clipping.
export const slideInFromLeft = keyframes({
  from: { opacity: 0, transform: 'translateX(-24px)' },
  to: { opacity: 1, transform: 'translateX(0)' },
});

export const slideOutToLeft = keyframes({
  from: { opacity: 1, transform: 'translateX(0)' },
  to: { opacity: 0, transform: 'translateX(-24px)' },
});

// Pure-translate pair for elements that physically cover/reveal another
// view (the bulk-actions bar over the footer counts). No opacity change —
// fading would let the covered content bleed through. 120% slides the
// element fully outside its containing block so nothing peeks past the
// container's padding edge.
export const coverFromRight = keyframes({
  from: { transform: 'translateX(120%)' },
  to: { transform: 'translateX(0)' },
});

export const uncoverToRight = keyframes({
  from: { transform: 'translateX(0)' },
  to: { transform: 'translateX(120%)' },
});
