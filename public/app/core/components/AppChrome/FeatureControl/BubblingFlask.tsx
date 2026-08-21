import { css, cx, keyframes } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data';
import { type IconSize, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/internal';

// The `flask` unicon, with the two bubbles baked into its path removed so we can draw
// and animate our own instead.
const FLASK =
  'M20.11,17.49,15,8.73V4h1a1,1,0,0,0,0-2H8A1,1,0,0,0,8,4H9V8.73L3.89,17.49A3,3,0,0,0,6.48,22h11a3,3,0,0,0,2.59-4.51Zm-9.25-8A1,1,0,0,0,11,9V4h2V9a1,1,0,0,0,.14.5L14,11H10Zm7.52,10a1,1,0,0,1-.86.5h-11a1,1,0,0,1-.86-.5,1,1,0,0,1,0-1L8.83,13h6.35l3.2,5.5A1,1,0,0,1,18.38,19.5Z';

// The flask tapers towards the neck, so a bubble has to be fully faded out by the time it
// reaches the top of its travel, or it pokes through the glass.
const rise = keyframes({
  '0%': { transform: 'translate(0, 2.4px) scale(0.3)', opacity: 0 },
  '25%': { transform: 'translate(0.35px, 1px) scale(1)', opacity: 1 },
  '60%': { transform: 'translate(-0.35px, -1px) scale(1)' },
  '90%': { opacity: 0 },
  '100%': { transform: 'translate(0.2px, -2.8px) scale(0.8)', opacity: 0 },
});

// Two bubbles arc up out of the mouth and away to either side, then idle at zero opacity for
// the rest of the cycle so they pop out occasionally rather than in a constant stream. The
// whole arc stays inside the 24x24 box, so the icon still occupies exactly its own square.
const arcLeft = keyframes({
  '0%': { transform: 'translate(0, 0) scale(0.3)', opacity: 0 },
  '8%': { transform: 'translate(-1px, -1.4px) scale(1)', opacity: 1 },
  '25%': { transform: 'translate(-4px, -2.2px) scale(1)', opacity: 1 },
  '45%': { transform: 'translate(-7px, 1px) scale(0.9)', opacity: 0.7 },
  '65%': { transform: 'translate(-9.5px, 5px) scale(0.7)', opacity: 0 },
  '100%': { transform: 'translate(-9.5px, 5px) scale(0.7)', opacity: 0 },
});

const arcRight = keyframes({
  '0%': { transform: 'translate(0, 0) scale(0.3)', opacity: 0 },
  '8%': { transform: 'translate(1px, -1.4px) scale(1)', opacity: 1 },
  '25%': { transform: 'translate(4px, -2.2px) scale(1)', opacity: 1 },
  '45%': { transform: 'translate(7px, 1px) scale(0.9)', opacity: 0.7 },
  '65%': { transform: 'translate(9.5px, 5px) scale(0.7)', opacity: 0 },
  '100%': { transform: 'translate(9.5px, 5px) scale(0.7)', opacity: 0 },
});

// Resting positions are what's rendered when the bubbles aren't animating, so they have to
// look like a plausible still frame. The two arcing bubbles are parked inside the solid glass
// of the lip, which hides them until they animate out — including under reduced motion.
const BUBBLES = [
  { cx: 10, cy: 16.2, r: 1.15, animation: rise, easing: 'ease-in-out', duration: '2.1s', delay: '0s' },
  { cx: 13.6, cy: 16.5, r: 0.9, animation: rise, easing: 'ease-in-out', duration: '2.7s', delay: '0.9s' },
  { cx: 12, cy: 3, r: 0.65, animation: arcLeft, easing: 'linear', duration: '3.2s', delay: '0.6s' },
  { cx: 12, cy: 3, r: 0.6, animation: arcRight, easing: 'linear', duration: '3.8s', delay: '2s' },
];

export interface BubblingFlaskProps {
  /** Colour the flask, and animate the bubbles rising through it */
  bubbling?: boolean;
  /** Matches the sizes of the `Icon` component */
  size?: IconSize;
}

export const BubblingFlask = ({ bubbling = false, size = 'md' }: BubblingFlaskProps) => {
  const styles = useStyles2(getStyles);
  const svgSize = getSvgSize(size);

  return (
    <svg
      className={cx(styles.svg, bubbling && styles.active)}
      width={svgSize}
      height={svgSize}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d={FLASK} />
      {BUBBLES.map(({ cx, cy, r }, index) => (
        <circle key={index} cx={cx} cy={cy} r={r} className={bubbling ? styles.bubbles[index] : undefined} />
      ))}
    </svg>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  svg: css({
    display: 'inline-block',
    fill: 'currentColor',
    flexShrink: 0,
    // line-height: 0; is needed for correct icon alignment in Safari
    lineHeight: 0,
    verticalAlign: 'middle',
  }),
  // Colour carries the state on its own, so it still reads as active for anyone who has
  // asked for reduced motion.
  active: css({
    color: theme.colors.warning.text,
  }),
  bubbles: BUBBLES.map(({ animation, easing, duration, delay }) =>
    css({
      // Without fill-box, scale() would be relative to the centre of the viewBox and drag
      // the bubble across the flask instead of growing it in place.
      transformBox: 'fill-box',
      transformOrigin: 'center',

      [theme.transitions.handleMotion('no-preference')]: {
        animationName: animation,
        animationDuration: duration,
        animationDelay: delay,
        animationTimingFunction: easing,
        animationIterationCount: 'infinite',
      },
    })
  ),
});
