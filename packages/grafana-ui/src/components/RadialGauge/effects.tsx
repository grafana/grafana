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

export function SpotlightGradient({ gaugeId }: { gaugeId: string }) {
  return (
    <radialGradient id={`spotlight-${gaugeId}`}>
      <stop offset="0%" stopColor="white" stopOpacity={1} />
      <stop offset="10%" stopColor="white" stopOpacity={1} />
      <stop offset="35%" stopColor="white" stopOpacity={0.5} />
      <stop offset="80%" stopColor="white" stopOpacity={0.1} />
      <stop offset="100%" stopColor="white" stopOpacity={0} />
    </radialGradient>
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
