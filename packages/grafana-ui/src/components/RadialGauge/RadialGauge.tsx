import { DataFrame, getFieldDisplayValues } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

export interface RadialGaugeProps {
  frames: DataFrame[];
  size?: number;
  startAngle?: number;
  fullAngle?: number;
}

export function RadialGauge({ frames, size = 256, startAngle = 0, fullAngle = 360 }: RadialGaugeProps) {
  const theme = useTheme2();
  const width = size * 1.2;
  const height = size * 1.2;

  const values = getFieldDisplayValues({
    fieldConfig: { overrides: [], defaults: {} },
    reduceOptions: { calcs: ['last'] },
    replaceVariables: (value) => value,
    theme: theme,
    data: frames,
  });

  return (
    <svg width={width} height={height}>
      <g>
        {values.map((displayValue, i) => {
          const value = displayValue.display.numeric;
          const min = displayValue.field.min ?? 0;
          const max = displayValue.field.max ?? 100;

          return (
            <RadialBar
              key={i}
              value={value}
              min={min}
              max={max}
              startAngle={startAngle}
              fullAngle={fullAngle}
              size={130}
            />
          );
        })}
      </g>
    </svg>
  );
}

export interface RadialBarProps {
  value: number;
  min: number;
  max: number;
  size?: number;
  startAngle?: number;
  fullAngle?: number;
}

export function RadialBar({ value, min, max, startAngle = 0, size, fullAngle = 360 }: RadialBarProps) {
  const theme = useTheme2();
  const angle = ((value - min) / (max - min)) * fullAngle;
  const trackStart = angle;
  const trackLength = fullAngle - trackStart;

  return (
    <>
      <RadialArcPath
        angle={trackLength}
        size={size}
        startAngle={trackStart}
        fullAngle={fullAngle}
        color={theme.colors.action.hover}
      />
      <RadialArcPath angle={angle} size={size} startAngle={startAngle} fullAngle={fullAngle} />
    </>
  );
}

export interface RadialArcPathProps {
  angle: number;
  startAngle?: number;
  size?: number;
  fullAngle?: number;
  color?: string;
}

export function RadialArcPath({ startAngle, angle, size, fullAngle, color }: RadialArcPathProps) {
  const path = buildArcPath({
    centerX: 175,
    centerY: 175,
    startAngle: startAngle ?? 0,
    angle,
    size: size ?? 130,
    fullAngle: fullAngle ?? 360,
  });

  return (
    <path
      d={path}
      fill="none"
      fillOpacity="0.85"
      stroke={color ?? '#11d1c1ff'}
      strokeOpacity="1"
      strokeLinecap="butt"
      strokeWidth="15"
      strokeDasharray="0"
      filter="url(#SvgjsFilter1005)"
    ></path>
  );
}

interface ArcPathOptions {
  centerX: number;
  centerY: number;
  startAngle: number;
  angle: number;
  size: number;
  fullAngle: number;
}

function buildArcPath({ centerX, centerY, startAngle, angle, size, fullAngle }: ArcPathOptions) {
  let startDeg = startAngle;
  let startRadians = (Math.PI * (startDeg - 90)) / 180;
  let endDeg = angle + startAngle;

  if (Math.ceil(endDeg) > fullAngle) {
    endDeg -= fullAngle;
  }

  let endRadians = (Math.PI * (endDeg - 90)) / 180;

  let x1 = centerX + size * Math.cos(startRadians);
  let y1 = centerY + size * Math.sin(startRadians);
  let x2 = centerX + size * Math.cos(endRadians);
  let y2 = centerY + size * Math.sin(endRadians);

  let largeArc = angle > 180 ? 1 : 0;

  return ['M', x1, y1, 'A', size, size, 0, largeArc, 1, x2, y2].join(' ');
}

// function toCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
//   let radian = ((angleInDegrees - 90) * Math.PI) / 180.0;

//   return {
//     x: centerX + radius * Math.cos(radian),
//     y: centerY + radius * Math.sin(radian),
//   };
// }
