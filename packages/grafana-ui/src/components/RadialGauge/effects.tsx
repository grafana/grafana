import { FieldDisplay } from '@grafana/data';

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
  barWidth,
  size,
  margin,
  roundedBars,
}: {
  gaugeId: string;
  fieldDisplay: FieldDisplay;
  startAngle: number;
  endAngle: number;
  size: number;
  barWidth: number;
  margin: number;
  roundedBars?: boolean;
}) {
  const arcSize = size - barWidth;
  const radius = arcSize / 2 - margin;

  const value = fieldDisplay.display.numeric;
  const min = fieldDisplay.field.min ?? 0;
  const max = fieldDisplay.field.max ?? 100;
  const range = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;

  let angle = ((value - min) / (max - min)) * range;

  if (angle > range) {
    angle = range;
  }

  let spotlightAngle = angle + startAngle;

  const center = size / 2;
  const angleRadian = ((spotlightAngle - 90) * Math.PI) / 180;

  let x1 = center + radius * Math.cos(angleRadian - 0.15);
  let y1 = center + radius * Math.sin(angleRadian - 0.15);
  let x2 = center + radius * Math.cos(angleRadian);
  let y2 = center + radius * Math.sin(angleRadian);

  return (
    <linearGradient x1={x1} y1={y1} x2={x2} y2={y2} id={`spotlight-${gaugeId}`} gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="white" stopOpacity={0} />
      <stop offset="90%" stopColor="white" stopOpacity={0.6} />
      <stop offset="100%" stopColor="white" stopOpacity={roundedBars ? 0.8 : 1} />
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
