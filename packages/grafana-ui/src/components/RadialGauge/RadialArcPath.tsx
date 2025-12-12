import { GaugeDimensions, toRad } from './utils';

export interface RadialArcPathPropsBase {
  startAngle: number;
  dimensions: GaugeDimensions;
  color: string;
  glowFilter?: string;
  arcLengthDeg: number;
  roundedBars?: boolean;
  showGuideDots?: boolean;
  guideDotStartColor?: string;
  guideDotEndColor?: string;
}

interface RadialArcPathPropsWithGuideDot extends RadialArcPathPropsBase {
  showGuideDots: true;
  guideDotStartColor: string;
  guideDotEndColor: string;
}

type RadialArcPathProps = RadialArcPathPropsBase | RadialArcPathPropsWithGuideDot;

const MAX_DOT_RADIUS = 8;

export function RadialArcPath({
  startAngle: angle,
  dimensions,
  color,
  glowFilter,
  arcLengthDeg,
  roundedBars,
  showGuideDots,
  guideDotStartColor,
  guideDotEndColor,
}: RadialArcPathProps) {
  const { radius, centerX, centerY, barWidth } = dimensions;

  if (arcLengthDeg === 360) {
    // For some reason a 100% full arc cannot be rendered
    arcLengthDeg = 359.99;
  }

  const startRadians = toRad(angle);
  const endRadians = toRad(angle + arcLengthDeg);

  let x1 = centerX + radius * Math.cos(startRadians);
  let y1 = centerY + radius * Math.sin(startRadians);
  let x2 = centerX + radius * Math.cos(endRadians);
  let y2 = centerY + radius * Math.sin(endRadians);

  const largeArc = arcLengthDeg > 180 ? 1 : 0;

  const path = ['M', x1, y1, 'A', radius, radius, 0, largeArc, 1, x2, y2].join(' ');
  const dotRadius = Math.min((barWidth / 2) * 0.4, MAX_DOT_RADIUS);

  return (
    <>
      <path
        d={path}
        fill="none"
        fillOpacity="1"
        stroke={color}
        strokeOpacity="1"
        strokeWidth={barWidth}
        filter={glowFilter}
        strokeLinecap={roundedBars ? 'round' : 'butt'}
        className="radial-arc-path"
      />
      {showGuideDots && (
        <>
          {arcLengthDeg > 5 && <circle cx={x1} cy={y1} r={dotRadius} fill={guideDotStartColor} />}
          <circle cx={x2} cy={y2} r={dotRadius} fill={guideDotEndColor} />
        </>
      )}
    </>
  );
}
