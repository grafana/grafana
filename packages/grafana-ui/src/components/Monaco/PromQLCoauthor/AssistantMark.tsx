import { COLORS } from './scriptedData';

interface Props {
  size?: number;
  color?: string;
}

/** The assistant sparkle mark, matching the design canvas. */
export function AssistantMark({ size = 13, color = COLORS.assistant }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
      <path
        d="M12 3 L14 9.5 L21 12 L14 14.5 L12 21 L10 14.5 L3 12 L10 9.5 Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
