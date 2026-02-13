import { colorManipulator, GrafanaTheme2 } from '@grafana/data';

import { RadialGaugeDimensions } from './types';

// some utility transparent white colors for gradients
const TRANSPARENT_WHITE = '#ffffff00';
const MOSTLY_TRANSPARENT_WHITE = '#ffffff88';
const MOSTLY_OPAQUE_WHITE = '#ffffffbb';
const OPAQUE_WHITE = '#ffffff';

const MIN_GLOW_SIZE = 0.75;
const GLOW_FACTOR = 0.08;

export interface GlowGradientProps {
  id: string;
  barWidth: number;
}

export function GlowGradient({ id, barWidth }: GlowGradientProps) {
  // 0.75 is the minimum glow size, and it scales with bar width
  const glowSize = MIN_GLOW_SIZE + barWidth * GLOW_FACTOR;

  return (
    <filter id={id} filterUnits="userSpaceOnUse">
      <feGaussianBlur stdDeviation={glowSize} />
      <feComponentTransfer>
        <feFuncA type="linear" slope="1" />
      </feComponentTransfer>
      <feBlend in2="SourceGraphic" />
    </filter>
  );
}

const CENTER_GLOW_OPACITY = 0.25;

export interface CenterGlowProps {
  dimensions: RadialGaugeDimensions;
  gaugeId: string;
  color?: string;
}

export function MiddleCircleGlow({ dimensions, gaugeId, color }: CenterGlowProps) {
  const gradientId = `circle-glow-${gaugeId}`;
  const transparentColor = color ? colorManipulator.alpha(color, CENTER_GLOW_OPACITY) : color;

  return (
    <>
      <defs>
        <radialGradient id={gradientId} r="50%" fr="0%">
          <stop offset="0%" stopColor={transparentColor} />
          <stop offset="90%" stopColor={TRANSPARENT_WHITE} />
        </radialGradient>
      </defs>
      <g>
        <circle cx={dimensions.centerX} cy={dimensions.centerY} r={dimensions.radius} fill={`url(#${gradientId})`} />
      </g>
    </>
  );
}

interface SpotlightGradientProps {
  id: string;
  dimensions: RadialGaugeDimensions;
  angle: number;
  roundedBars: boolean;
  theme: GrafanaTheme2;
}

export function SpotlightGradient({ id, dimensions, roundedBars, angle, theme }: SpotlightGradientProps) {
  if (theme.isLight) {
    return null;
  }

  const angleRadian = ((angle - 90) * Math.PI) / 180;

  let x1 = dimensions.centerX + dimensions.radius * Math.cos(angleRadian - 0.2);
  let y1 = dimensions.centerY + dimensions.radius * Math.sin(angleRadian - 0.2);
  let x2 = dimensions.centerX + dimensions.radius * Math.cos(angleRadian);
  let y2 = dimensions.centerY + dimensions.radius * Math.sin(angleRadian);

  return (
    <linearGradient x1={x1} y1={y1} x2={x2} y2={y2} id={id} gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor={TRANSPARENT_WHITE} />
      <stop offset="95%" stopColor={MOSTLY_TRANSPARENT_WHITE} />
      {roundedBars && <stop offset="100%" stopColor={roundedBars ? MOSTLY_OPAQUE_WHITE : OPAQUE_WHITE} />}
    </linearGradient>
  );
}
