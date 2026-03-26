import { colorManipulator, GrafanaTheme2 } from '@grafana/data';

import { ARC_END } from './constants';
import { RadialGaugeDimensions, RadialShape } from './types';

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
  shape?: RadialShape;
}

export function MiddleCircleGlow({ dimensions, gaugeId, color, shape }: CenterGlowProps) {
  const gradientId = `circle-glow-${gaugeId}`;
  const clipId = `circle-glow-clip-${gaugeId}`;
  const transparentColor = color ? colorManipulator.alpha(color, CENTER_GLOW_OPACITY) : color;

  // For the 'gauge' shape the arc ends at ARC_END degrees (110°) on the right side.
  // Using toRad convention (0° = up, clockwise), the arc endpoint Y offset from center is:
  //   radius * sin((ARC_END - 90) * π/180)  =  radius * sin(20°)  ≈  radius * 0.342
  // The clip rect bottom sits at that Y so the glow matches the flat-bottom opening of the arc.
  const isGaugeShape = shape === 'gauge';
  const arcEndOffsetY = Math.sin(((ARC_END - 90) * Math.PI) / 180);

  return (
    <>
      <defs>
        <radialGradient id={gradientId} r="50%" fr="0%">
          <stop offset="0%" stopColor={transparentColor} />
          <stop offset="90%" stopColor={TRANSPARENT_WHITE} />
        </radialGradient>
        {isGaugeShape && (
          <clipPath id={clipId}>
            {/* Clip bottom at the Y where the arc endpoints sit: centerY + radius * sin(20°) */}
            <rect
              x={dimensions.centerX - dimensions.radius}
              y={dimensions.centerY - dimensions.radius}
              width={dimensions.radius * 2}
              height={dimensions.radius * (1 + arcEndOffsetY)}
            />
          </clipPath>
        )}
      </defs>
      <g>
        <circle
          cx={dimensions.centerX}
          cy={dimensions.centerY}
          r={dimensions.radius}
          fill={`url(#${gradientId})`}
          clipPath={isGaugeShape ? `url(#${clipId})` : undefined}
        />
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
