import { useId } from 'react';

import {
  DataFrame,
  DisplayValue,
  FieldDisplay,
  getFieldColorMode,
  getFieldDisplayValues,
  GrafanaTheme2,
} from '@grafana/data';
import { GraphGradientMode } from '@grafana/schema';

import { useTheme2 } from '../../themes/ThemeContext';

export interface RadialGaugeProps {
  frames: DataFrame[];
  size?: number;
  startAngle?: number;
  endAngle?: number;
  gradientMode?: GraphGradientMode;
  barWidth?: number;
}

export function RadialGauge(props: RadialGaugeProps) {
  const {
    frames,
    size = 256,
    startAngle = 0,
    endAngle = 360,
    gradientMode = GraphGradientMode.None,
    barWidth = 10,
  } = props;
  const theme = useTheme2();
  const gaugeId = useId();
  const width = size;
  const height = size;

  const values = getFieldDisplayValues({
    fieldConfig: { overrides: [], defaults: {} },
    reduceOptions: { calcs: ['last'] },
    replaceVariables: (value) => value,
    theme: theme,
    data: frames,
  });

  return (
    <svg width={width} height={height}>
      <defs>
        {gradientMode !== GraphGradientMode.None &&
          values.map((displayValue, barIndex) => (
            <GradientDef key={barIndex} fieldDisplay={displayValue} index={barIndex} theme={theme} gaugeId={gaugeId} />
          ))}
      </defs>
      <g>
        {values.map((displayValue, barIndex) => {
          const value = displayValue.display.numeric;
          const min = displayValue.field.min ?? 0;
          const max = displayValue.field.max ?? 100;
          const barColor = getColorForBar(displayValue.display, barIndex, gradientMode, gaugeId);

          return (
            <RadialBar
              key={barIndex}
              value={value}
              min={min}
              max={max}
              startAngle={startAngle}
              endAngle={endAngle}
              size={size}
              color={barColor}
              barWidth={barWidth}
            />
          );
        })}
      </g>
    </svg>
  );
}

function getColorForBar(
  displayValue: DisplayValue,
  barIndex: number,
  gradientMode: GraphGradientMode,
  gaugeId: string
) {
  if (gradientMode === GraphGradientMode.None) {
    return displayValue.color ?? 'gray';
  }

  return `url(#${getGradientId(gaugeId, barIndex)})`;
}

interface GradientDefProps {
  fieldDisplay: FieldDisplay;
  index: number;
  theme: GrafanaTheme2;
  gaugeId: string;
}

function GradientDef({ fieldDisplay, index, theme, gaugeId }: GradientDefProps) {
  const colorModeId = fieldDisplay.field.color?.mode;
  const valuePercent = fieldDisplay.display.percent ?? 0;
  const colorMode = getFieldColorMode(colorModeId);

  function renderStops() {
    if (colorMode.getColors) {
      const colors = colorMode.getColors(theme);
      const count = colors.length;

      return colors.map((stopColor, i) => (
        <stop key={i} offset={`${(i / (count - 1)).toFixed(2)}`} stopColor={stopColor} stopOpacity={1}></stop>
      ));
    }

    return null;
  }

  console.log('valuePercent', valuePercent);
  return (
    <linearGradient x1="0" y1="1" x2={1 / valuePercent} y2="1" id={getGradientId(gaugeId, index)}>
      {renderStops()}
    </linearGradient>
  );
}

function getGradientId(gaugeId: string, index: number) {
  return `radial-gauge-${gaugeId}-${index}`;
}

export interface RadialBarProps {
  value: number;
  min: number;
  max: number;
  size: number;
  startAngle?: number;
  endAngle?: number;
  color: string;
  barWidth: number;
}

export function RadialBar({ value, min, max, startAngle = 0, size, endAngle = 360, color, barWidth }: RadialBarProps) {
  const theme = useTheme2();
  const range = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;
  const angle = ((value - min) / (max - min)) * range;
  const trackStart = startAngle + angle;
  const trackLength = range - angle;

  return (
    <>
      <RadialArcPath
        angle={trackLength}
        size={size}
        startAngle={trackStart}
        fullAngle={endAngle}
        color={theme.colors.action.hover}
        barWidth={barWidth}
      />
      <RadialArcPath
        angle={angle}
        size={size}
        startAngle={startAngle}
        fullAngle={endAngle}
        color={color}
        barWidth={barWidth}
      />
    </>
  );
}

export interface RadialArcPathProps {
  angle: number;
  startAngle?: number;
  size: number;
  fullAngle?: number;
  color: string;
  barWidth: number;
}

export function RadialArcPath({ startAngle, angle, size, fullAngle, color, barWidth }: RadialArcPathProps) {
  const arcSize = size - barWidth;
  const path = buildArcPath({
    centerX: size / 2,
    centerY: size / 2,
    startAngle: startAngle ?? 0,
    angle,
    size: arcSize / 2,
    fullAngle: fullAngle ?? 360,
  });

  return (
    <path
      d={path}
      fill="none"
      fillOpacity="0.85"
      stroke={color}
      strokeOpacity="1"
      //strokeLinecap="butt"
      strokeLinecap="round"
      strokeWidth={barWidth}
      strokeDasharray="0"
    />
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

  //   if (Math.ceil(endDeg) > fullAngle) {
  //     endDeg -= fullAngle;
  //   }

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
