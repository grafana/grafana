import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';

import { ARC_END } from './constants';
import { type RadialGaugeDimensions, type RadialShape } from './types';

// some utility transparent white colors for gradients
const TRANSPARENT_WHITE = '#ffffff00';

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

  // Clip the glow to the gauge arc's flat-bottom opening (arc endpoints sit at centerY + radius * sin(20°)).
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
  color: string;
}

export function SpotlightGradient({ id, dimensions, roundedBars, angle, theme, color }: SpotlightGradientProps) {
  if (theme.isLight) {
    return null;
  }

  // Shift the centre forward by the endcap's angular half-width so the bloom sits over the visual tip.
  const endcapOffsetRad = roundedBars ? dimensions.barWidth / (2 * dimensions.radius) : 0;
  const angleRadian = ((angle - 90) * Math.PI) / 180 + endcapOffsetRad;

  const cx = dimensions.centerX + dimensions.radius * Math.cos(angleRadian);
  const cy = dimensions.centerY + dimensions.radius * Math.sin(angleRadian);
  const glowRadius = dimensions.barWidth * 1.5;
  const tintTip = colorManipulator.alpha(colorManipulator.lighten(color, 0.8), 0.85);

  return (
    <radialGradient id={id} cx={cx} cy={cy} r={glowRadius} fx={cx} fy={cy} gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor={tintTip} />
      <stop offset="100%" stopColor={TRANSPARENT_WHITE} />
    </radialGradient>
  );
}
