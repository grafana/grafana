import { useId } from 'react';

import { RadialColorDefs } from './RadialColorDefs';
import { RadialShape } from './RadialGauge';
import { GaugeDimensions, toRad } from './utils';

export interface RadialArcPathPropsBase {
  startAngle: number;
  dimensions: GaugeDimensions;
  colorDefs: RadialColorDefs;
  arcLengthDeg: number;
  shape: RadialShape;
  color?: string;
  gradient?: string;
  glowFilter?: string;
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

function drawRadialArcPath({
  angle,
  arcLengthDeg,
  dimensions,
  roundedBars,
}: {
  angle: number;
  dimensions: GaugeDimensions;
  arcLengthDeg: number;
  roundedBars?: boolean;
}): string {
  const { radius, centerX, centerY, barWidth } = dimensions;

  if (arcLengthDeg === 360) {
    // For some reason a 100% full arc cannot be rendered
    arcLengthDeg = 359.99;
  }

  const startRadians = toRad(angle);
  const endRadians = toRad(angle + arcLengthDeg);

  const largeArc = arcLengthDeg > 180 ? 1 : 0;

  const outerR = radius + barWidth / 2;
  const innerR = Math.max(0, radius - barWidth / 2);

  const ox1 = centerX + outerR * Math.cos(startRadians);
  const oy1 = centerY + outerR * Math.sin(startRadians);
  const ox2 = centerX + outerR * Math.cos(endRadians);
  const oy2 = centerY + outerR * Math.sin(endRadians);

  const ix1 = centerX + innerR * Math.cos(startRadians);
  const iy1 = centerY + innerR * Math.sin(startRadians);
  const ix2 = centerX + innerR * Math.cos(endRadians);
  const iy2 = centerY + innerR * Math.sin(endRadians);

  const capR = barWidth / 2;

  const pathParts = [
    // start at outer start
    'M',
    ox1,
    oy1,
    // outer arc from start to end (clockwise)
    'A',
    outerR,
    outerR,
    0,
    largeArc,
    1,
    ox2,
    oy2,
  ];

  if (roundedBars) {
    // rounded end cap: small arc connecting outer end to inner end
    pathParts.push('A', capR, capR, 0, 0, 1, ix2, iy2);
  } else {
    // straight line to inner end
    pathParts.push('L', ix2, iy2);
  }

  if (innerR <= 0) {
    // if inner radius collapsed to center, line to center and close
    pathParts.push('L', centerX, centerY, 'Z');
  } else {
    // inner arc from end back to start (counter-clockwise)
    pathParts.push('A', innerR, innerR, 0, largeArc, 0, ix1, iy1);

    if (roundedBars) {
      // rounded start cap: small arc connecting inner start back to outer start
      pathParts.push('A', capR, capR, 0, 0, 1, ox1, oy1);
    } else {
      // straight line back to outer start
      pathParts.push('L', ox1, oy1);
    }

    pathParts.push('Z');
  }

  return pathParts.join(' ');
}

export function RadialArcPath({
  startAngle: angle,
  dimensions,
  color,
  colorDefs,
  shape,
  arcLengthDeg,
  glowFilter,
  roundedBars,
  showGuideDots,
  guideDotStartColor,
  guideDotEndColor,
}: RadialArcPathProps) {
  const id = useId();
  const { radius, centerX, centerY, barWidth } = dimensions;

  const startRadians = toRad(angle);
  const endRadians = toRad(angle + arcLengthDeg);
  const [startColor, endColor] = colorDefs.getEndpointColors();

  const path = drawRadialArcPath({ angle, arcLengthDeg, dimensions, roundedBars });
  let x1 = centerX + radius * Math.cos(startRadians);
  let y1 = centerY + radius * Math.sin(startRadians);
  let x2 = centerX + radius * Math.cos(endRadians);
  let y2 = centerY + radius * Math.sin(endRadians);

  const dotRadius = Math.min((barWidth / 2) * 0.4, MAX_DOT_RADIUS);

  return (
    <>
      <clipPath id={id}>
        <path d={path} />
      </clipPath>
      <g filter={glowFilter}>
        <foreignObject
          x={centerX - radius - barWidth}
          y={centerY - radius - barWidth}
          width={(radius + barWidth) * 2}
          height={(radius + barWidth) * 2}
          clipPath={`url(#${id})`}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: color ? undefined : colorDefs.getGradientDef(),
              backgroundColor: color,
            }}
          />
        </foreignObject>
      </g>

      {showGuideDots && (
        <>
          {shape === 'circle' && (
            <>
              <circle cx={x1} cy={y1} r={barWidth / 2} fill={startColor} />
              <circle cx={x2} cy={y2} r={barWidth / 2} fill={endColor} />
            </>
          )}

          {arcLengthDeg > 5 && <circle cx={x1} cy={y1} r={dotRadius} fill={guideDotStartColor} />}
          <circle cx={x2} cy={y2} r={dotRadius} fill={guideDotEndColor} />
        </>
      )}
    </>
  );
}
