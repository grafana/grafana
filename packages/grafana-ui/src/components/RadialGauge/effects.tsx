import { DisplayValue, FieldDisplay } from '@grafana/data';

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
}: {
  gaugeId: string;
  fieldDisplay: FieldDisplay;
  startAngle: number;
  endAngle: number;
}) {
  const value = fieldDisplay.display.numeric;
  const min = fieldDisplay.field.min ?? 0;
  const max = fieldDisplay.field.max ?? 100;
  const range = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;

  let angle = ((value - min) / (max - min)) * range;

  if (angle > range) {
    angle = range;
  }

  const angleRad = (angle - 90) * (Math.PI / 180);

  //   const x1 = Math.cos(angleRad) * 1;
  //   const y1 = Math.sin(angleRad) * 1;

  const tangent = getPerpendicularVectors(angle - 90).counterClockwiseTangent;
  //   const x2 = tangent.x;
  //   const y2 = tangent.y;
  const x1 = tangent.x > 0 ? 0 : Math.abs(tangent.x);
  const y1 = tangent.y > 0 ? 0 : Math.abs(tangent.y);
  const x2 = tangent.x > 0 ? tangent.x : 0;
  const y2 = tangent.y > 0 ? tangent.y : 0;
  console.log('angle', angle);

  //   console.log('vector x1', x1);
  //   console.log('vector y1', y1);
  //   console.log('vector x2', x2);
  //   console.log('vector y2', y2);
  //   console.log('vector x2', x2);
  //   console.log('vector y2', y2);
  //alert(`x1: ${x1}, y1: ${y1}, tangent.x: ${x1 + tangent.x}, tangent.y: ${y1 + tangent.y}`);

  return (
    <linearGradient x1={x1} y1={y1} x2={x2} y2={y2} id={`spotlight-${gaugeId}`}>
      <stop offset="0%" stopColor="white" stopOpacity={0} />
      <stop offset="100%" stopColor="white" stopOpacity={1} />
    </linearGradient>
  );
}

/**
 * Calculate perpendicular vectors at a point on a circle
 * @param angleDegrees - angle in degrees from positive x-axis
 * @returns object with different perpendicular vector options
 */
export function getPerpendicularVectors(angleDegrees: number) {
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return {
    // Tangent vectors (perpendicular to radius)
    clockwiseTangent: { x: sin, y: -cos },
    counterClockwiseTangent: { x: -sin, y: cos },
  };
}

export function CenterGlowGradient({ gaugeId, color }: { gaugeId: string; color: string }) {
  return (
    <radialGradient id={`circle-glow-${gaugeId}`} r={'50%'} fr={'0%'}>
      <stop offset="0%" stopColor={color} stopOpacity={0.2} />
      <stop offset="90%" stopColor={color} stopOpacity={0} />
    </radialGradient>
  );
}
