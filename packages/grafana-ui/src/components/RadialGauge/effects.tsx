import { GrafanaTheme2 } from '@grafana/data';

import { GaugeDimensions } from './utils';

export interface GlowGradientProps {
  id: string;
  radius: number;
}

export function GlowGradient({ id, radius }: GlowGradientProps) {
  const glowSize = 0.03 * radius;

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

export function SpotlightGradient({
  id,
  dimensions,
  roundedBars,
  angle,
  theme,
}: {
  id: string;
  dimensions: GaugeDimensions;
  angle: number;
  roundedBars: boolean;
  theme: GrafanaTheme2;
}) {
  const angleRadian = ((angle - 90) * Math.PI) / 180;

  let x1 = dimensions.centerX + dimensions.radius * Math.cos(angleRadian - 0.2);
  let y1 = dimensions.centerY + dimensions.radius * Math.sin(angleRadian - 0.2);
  let x2 = dimensions.centerX + dimensions.radius * Math.cos(angleRadian);
  let y2 = dimensions.centerY + dimensions.radius * Math.sin(angleRadian);

  if (theme.isLight) {
    return (
      <linearGradient x1={x1} y1={y1} x2={x2} y2={y2} id={id} gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={'black'} stopOpacity={0.0} />
        <stop offset="90%" stopColor={'black'} stopOpacity={0.0} />
        <stop offset="91%" stopColor={'black'} stopOpacity={1} />
      </linearGradient>
    );
  }

  return (
    <linearGradient x1={x1} y1={y1} x2={x2} y2={y2} id={id} gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor={'white'} stopOpacity={0.0} />
      <stop offset="95%" stopColor={'white'} stopOpacity={0.5} />
      {roundedBars && <stop offset="100%" stopColor={'white'} stopOpacity={roundedBars ? 0.7 : 1} />}
    </linearGradient>
  );
}

export function CenterGlowGradient({ gaugeId, color }: { gaugeId: string; color: string }) {
  return (
    <radialGradient id={`circle-glow-${gaugeId}`} r={'50%'} fr={'0%'}>
      <stop offset="0%" stopColor={color} stopOpacity={0.2} />
      <stop offset="90%" stopColor={color} stopOpacity={0} />
    </radialGradient>
  );
}

export interface CenterGlowProps {
  dimensions: GaugeDimensions;
  gaugeId: string;
  color?: string;
}

export function MiddleCircleGlow({ dimensions, gaugeId, color }: CenterGlowProps) {
  const gradientId = `circle-glow-${gaugeId}`;

  return (
    <>
      <defs>
        <radialGradient id={gradientId} r={'50%'} fr={'0%'}>
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="90%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g>
        <circle cx={dimensions.centerX} cy={dimensions.centerY} r={dimensions.radius} fill={`url(#${gradientId})`} />
      </g>
    </>
  );
}
