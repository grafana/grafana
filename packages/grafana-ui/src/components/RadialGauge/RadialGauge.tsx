import { useId } from 'react';
import tinycolor from 'tinycolor2';

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

import { RadialText } from './RadialText';

export interface RadialGaugeProps {
  frames: DataFrame[];
  size?: number;
  startAngle?: number;
  endAngle?: number;
  gradientMode?: RadialGradientMode;
  barWidth?: number;
  roundedBars?: boolean;
  clockwise?: boolean;
  /** Adds a white spotlight for the end position */
  spotlight?: boolean;
}

export type RadialGradientMode = 'none' | 'scheme' | 'hue' | 'radial' | 'shade';

export function RadialGauge(props: RadialGaugeProps) {
  const {
    frames,
    size = 256,
    startAngle = 0,
    endAngle = 360,
    gradientMode = GraphGradientMode.None,
    barWidth = 10,
    roundedBars = true,
    clockwise = false,
    spotlight = false,
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
        {values.map((displayValue, barIndex) => (
          <GradientDef
            key={barIndex}
            fieldDisplay={displayValue}
            index={barIndex}
            theme={theme}
            gaugeId={gaugeId}
            gradientMode={gradientMode}
          />
        ))}
        {spotlight && (
          <radialGradient id={`spotlight-${gaugeId}`}>
            <stop offset="0%" stopColor="white" stopOpacity={1} />
            <stop offset="10%" stopColor="white" stopOpacity={1} />
            <stop offset="35%" stopColor="white" stopOpacity={0.5} />
            <stop offset="80%" stopColor="white" stopOpacity={0.1} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </radialGradient>
        )}
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
              gaugeId={gaugeId}
              value={value}
              min={min}
              max={max}
              startAngle={startAngle}
              endAngle={endAngle}
              size={size}
              color={barColor}
              barWidth={barWidth}
              roundedBars={roundedBars}
              clockwise={clockwise}
              spotlight={spotlight}
            />
          );
        })}
      </g>
      <g>{values.length === 1 && <RadialText displayValue={values[0].display} size={size} theme={theme} />}</g>
    </svg>
  );
}

function getColorForBar(
  displayValue: DisplayValue,
  barIndex: number,
  gradientMode: RadialGradientMode,
  gaugeId: string
) {
  if (gradientMode === 'none') {
    return displayValue.color ?? 'gray';
  }

  return `url(#${getGradientId(gaugeId, barIndex)})`;
}

interface GradientDefProps {
  fieldDisplay: FieldDisplay;
  index: number;
  theme: GrafanaTheme2;
  gaugeId: string;
  gradientMode: RadialGradientMode;
}

function GradientDef({ fieldDisplay, index, theme, gaugeId, gradientMode }: GradientDefProps) {
  const colorModeId = fieldDisplay.field.color?.mode;
  const valuePercent = fieldDisplay.display.percent ?? 0;
  const colorMode = getFieldColorMode(colorModeId);

  switch (gradientMode) {
    // Still not working
    case 'radial': {
      return (
        <radialGradient fr="45%" cx="50%" cy="50%" r="60%" id={getGradientId(gaugeId, index)}>
          <stop offset="0%" stopColor={'red'} stopOpacity={1} />
          <stop offset="100%" stopColor={'blue'} stopOpacity={1} />
        </radialGradient>
      );
    }
    case 'shade': {
      const color = fieldDisplay.display.color ?? 'gray';
      const color1 = tinycolor(color).darken(5);

      return (
        <linearGradient x1="0" y1="1" x2="1" y2="1" id={getGradientId(gaugeId, index)}>
          <stop offset="0%" stopColor={color1.toString()} stopOpacity={1} />
          <stop offset="50%" stopColor={tinycolor(color).lighten(15).toString()} stopOpacity={1} />
          <stop offset="53%" stopColor={tinycolor(color).lighten(15).toString()} stopOpacity={1} />
          <stop offset="90%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      );
    }
    case 'scheme': {
      if (colorMode.isContinuous && colorMode.getColors) {
        const colors = colorMode.getColors(theme);
        const count = colors.length;

        return (
          <linearGradient x1="0" y1="1" x2={1 / valuePercent} y2="1" id={getGradientId(gaugeId, index)}>
            {colors.map((stopColor, i) => (
              <stop key={i} offset={`${(i / (count - 1)).toFixed(2)}`} stopColor={stopColor} stopOpacity={1}></stop>
            ))}
          </linearGradient>
        );
      }

      return null;
    }
    case 'hue': {
      const color = fieldDisplay.display.color ?? 'gray';
      const color1 = tinycolor(color).spin(-20).darken(5);
      const color2 = tinycolor(color).saturate(20).spin(20).brighten(10);

      return (
        <linearGradient x1="0" y1="1" x2="1" y2="1" id={getGradientId(gaugeId, index)}>
          {theme.isDark ? (
            <>
              <stop offset="0%" stopColor={color2.lighten(10).toString()} stopOpacity={1} />
              <stop offset="100%" stopColor={color1.darken(10).toString()} stopOpacity={1} />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={color2.lighten(10).toString()} stopOpacity={1} />
              <stop offset="100%" stopColor={color1.toString()} stopOpacity={1} />
            </>
          )}
        </linearGradient>
      );
    }
  }

  return null;
}

function getGradientId(gaugeId: string, index: number) {
  return `radial-gauge-${gaugeId}-${index}`;
}

export interface RadialBarProps {
  gaugeId: string;
  value: number;
  min: number;
  max: number;
  size: number;
  startAngle: number;
  endAngle: number;
  color: string;
  barWidth: number;
  roundedBars?: boolean;
  clockwise: boolean;
  spotlight?: boolean;
}

export function RadialBar({
  gaugeId,
  value,
  min,
  max,
  startAngle,
  size,
  endAngle,
  color,
  barWidth,
  roundedBars,
  clockwise,
  spotlight,
}: RadialBarProps) {
  const theme = useTheme2();
  const range = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;
  const angle = ((value - min) / (max - min)) * range;

  if (!clockwise) {
    startAngle = endAngle - angle;
  }

  const trackStart = startAngle + angle;
  const trackLength = range - angle;

  return (
    <>
      <RadialArcPath
        gaugeId={gaugeId}
        angle={trackLength}
        size={size}
        startAngle={trackStart}
        color={theme.colors.action.hover}
        barWidth={barWidth}
        roundedBars={roundedBars}
        clockwise={clockwise}
      />
      <RadialArcPath
        gaugeId={gaugeId}
        angle={angle}
        size={size}
        startAngle={startAngle}
        color={color}
        barWidth={barWidth}
        roundedBars={roundedBars}
        clockwise={clockwise}
        spotlight={spotlight}
      />
    </>
  );
}

export interface RadialArcPathProps {
  gaugeId: string;
  angle: number;
  startAngle: number;
  size: number;
  color: string;
  barWidth: number;
  roundedBars?: boolean;
  clockwise?: boolean;
  spotlight?: boolean;
}

export function RadialArcPath({
  gaugeId,
  startAngle,
  angle,
  size,
  color,
  barWidth,
  roundedBars,
  clockwise,
  spotlight,
}: RadialArcPathProps) {
  const center = size / 2;
  const arcSize = size - barWidth;
  const radius = arcSize / 2;

  let startDeg = startAngle;
  let startRadians = (Math.PI * (startDeg - 90)) / 180;
  let endDeg = angle + startAngle;
  let endRadians = (Math.PI * (endDeg - 90)) / 180;

  let x1 = center + radius * Math.cos(startRadians);
  let y1 = center + radius * Math.sin(startRadians);
  let x2 = center + radius * Math.cos(endRadians);
  let y2 = center + radius * Math.sin(endRadians);

  let largeArc = angle > 180 ? 1 : 0;

  const path = ['M', x1, y1, 'A', radius, radius, 0, largeArc, 1, x2, y2].join(' ');

  return (
    <>
      <path
        d={path}
        fill="none"
        fillOpacity="0.85"
        stroke={color}
        strokeOpacity="1"
        //strokeLinecap="butt"
        strokeLinecap={roundedBars ? 'round' : 'butt'}
        strokeWidth={barWidth}
        strokeDasharray="0"
      />
      {clockwise && spotlight && angle > 5 && (
        <circle r={barWidth * 1} cx={x2} cy={y2} fill={`url(#spotlight-${gaugeId})`} />
      )}
      {!clockwise && spotlight && angle > 5 && (
        <circle r={barWidth * 1} cx={x1} cy={y1} fill={`url(#spotlight-${gaugeId})`} />
      )}
    </>
  );
}
