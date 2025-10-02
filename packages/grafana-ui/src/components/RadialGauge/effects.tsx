import { FieldDisplay } from '@grafana/data';

import { getValueAngleForValue } from './utils';

export interface GlowGradientProps {
  gaugeId: string;
  size: number;
}

export function GlowGradient({ gaugeId, size }: GlowGradientProps) {
  const glowSize = 0.025 * size;

  return (
    <filter id={`glow-${gaugeId}`} filterUnits="userSpaceOnUse">
      <feGaussianBlur stdDeviation={glowSize} />
      <feComponentTransfer>
        <feFuncA type="linear" slope="1" />
      </feComponentTransfer>
      <feBlend in2="SourceGraphic" />
    </filter>
  );
}

export function SpotlightGradient({
  gaugeId,
  fieldDisplay,
  startAngle,
  endAngle,
  radius,
  center,
  roundedBars,
}: {
  gaugeId: string;
  fieldDisplay: FieldDisplay;
  startAngle: number;
  endAngle: number;
  radius: number;
  center: number;
  roundedBars: boolean;
}) {
  const { angle } = getValueAngleForValue(fieldDisplay, startAngle, endAngle);

  let spotlightAngle = angle + startAngle;
  const angleRadian = ((spotlightAngle - 90) * Math.PI) / 180;

  let x1 = center + radius * Math.cos(angleRadian - 0.2);
  let y1 = center + radius * Math.sin(angleRadian - 0.2);
  let x2 = center + radius * Math.cos(angleRadian);
  let y2 = center + radius * Math.sin(angleRadian);

  return (
    <linearGradient x1={x1} y1={y1} x2={x2} y2={y2} id={`spotlight-${gaugeId}`} gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="white" stopOpacity={0.0} />
      <stop offset="95%" stopColor="white" stopOpacity={0.5} />
      {roundedBars && <stop offset="100%" stopColor="white" stopOpacity={roundedBars ? 0.7 : 1} />}
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
