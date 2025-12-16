import { RadialGaugeDimensions } from './types';

export interface GlowGradientProps {
  id: string;
  barWidth: number;
}

const MIN_GLOW_SIZE = 0.75;
const GLOW_FACTOR = 0.08;

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

const CENTER_GLOW_OPACITY = 0.15;

export function CenterGlowGradient({ gaugeId, color }: { gaugeId: string; color: string }) {
  return (
    <radialGradient id={`circle-glow-${gaugeId}`} r="50%" fr="0%">
      <stop offset="0%" stopColor={color} stopOpacity={CENTER_GLOW_OPACITY} />
      <stop offset="90%" stopColor={color} stopOpacity={0} />
    </radialGradient>
  );
}

export interface CenterGlowProps {
  dimensions: RadialGaugeDimensions;
  gaugeId: string;
  color?: string;
}

export function MiddleCircleGlow({ dimensions, gaugeId, color }: CenterGlowProps) {
  const gradientId = `circle-glow-${gaugeId}`;

  return (
    <>
      <defs>
        <radialGradient id={gradientId} r="50%" fr="0%">
          <stop offset="0%" stopColor={color} stopOpacity={CENTER_GLOW_OPACITY} />
          <stop offset="90%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g>
        <circle cx={dimensions.centerX} cy={dimensions.centerY} r={dimensions.radius} fill={`url(#${gradientId})`} />
      </g>
    </>
  );
}
