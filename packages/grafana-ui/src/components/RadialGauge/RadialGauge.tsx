import { css } from '@emotion/css';
import { useId } from 'react';
import tinycolor from 'tinycolor2';

import {
  DataFrame,
  DisplayValue,
  FieldConfig,
  FieldDisplay,
  getFieldColorMode,
  getFieldDisplayValues,
  GrafanaTheme2,
} from '@grafana/data';
import { GraphFieldConfig, GraphGradientMode, LineInterpolation } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { Sparkline } from '../Sparkline/Sparkline';

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
  glow?: boolean;
  centerShadow?: boolean;
  centerGlow?: boolean;
  sparkline?: boolean;
}

export type RadialGradientMode = 'none' | 'scheme' | 'hue' | 'shade';

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
    glow = false,
    centerShadow = false,
    centerGlow = false,
    sparkline = false,
  } = props;
  const theme = useTheme2();
  const gaugeId = useId();
  const width = size;
  const height = size;
  const styles = useStyles2(getStyles);

  const values = getFieldDisplayValues({
    fieldConfig: { overrides: [], defaults: {} },
    reduceOptions: { calcs: ['last'] },
    replaceVariables: (value) => value,
    theme: theme,
    data: frames,
    sparkline,
  });

  const margin = calculateMargin(size, glow, spotlight, barWidth);
  const color = values[0]?.display.color ?? theme.colors.primary.main;

  return (
    <div className={styles.vizWrapper}>
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
          {glow && <GlowGradient gaugeId={gaugeId} size={size} />}
          {centerGlow && (
            <radialGradient id={`circle-glow-${gaugeId}`} r={'50%'} fr={'0%'}>
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="90%" stopColor={color} stopOpacity={0} />
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
                margin={margin}
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
                glow={glow}
              />
            );
          })}
        </g>
        <g>
          {centerShadow && (
            <MiddleCircle
              barWidth={barWidth}
              fill={theme.colors.background.primary}
              size={size}
              margin={margin}
              className={styles.innerShadow}
            />
          )}
          {centerGlow && (
            <MiddleCircle barWidth={barWidth} fill={`url(#circle-glow-${gaugeId})`} size={size} margin={margin} />
          )}
          {values.length === 1 && <RadialText displayValue={values[0].display} size={size} theme={theme} />}
        </g>
      </svg>
      {sparkline && <RadialSparkline sparkline={values[0]?.sparkline} size={size} theme={theme} barWidth={barWidth} />}
    </div>
  );
}

interface GlowGradientProps {
  gaugeId: string;
  size: number;
}

function GlowGradient({ gaugeId, size }: GlowGradientProps) {
  const glowSize = 0.03 * size;

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

function calculateMargin(
  size: number,
  glow: boolean | undefined,
  spotlight: boolean | undefined,
  barWidth: number
): number {
  if (glow) {
    const glowSize = 0.03 * size;
    return glowSize + 4;
  }

  if (spotlight) {
    return barWidth / 4;
  }

  return 0;
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
  margin: number;
  glow?: boolean;
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
  margin,
  glow,
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
        margin={margin}
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
        glow={glow}
        margin={margin}
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
  glow?: boolean;
  margin: number;
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
  glow,
  margin,
}: RadialArcPathProps) {
  const center = size / 2;
  const arcSize = size - barWidth;
  const radius = arcSize / 2 - margin;

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
        strokeLinecap={roundedBars ? 'round' : 'butt'}
        strokeWidth={barWidth}
        strokeDasharray="0"
        filter={glow ? `url(#glow-${gaugeId})` : undefined}
      />
      {spotlight && angle > 5 && (
        <circle
          r={barWidth * 1}
          cx={clockwise ? x2 : x1}
          cy={clockwise ? y2 : y1}
          fill={`url(#spotlight-${gaugeId})`}
        />
      )}
    </>
  );
}

export interface MiddleCircleProps {
  size: number;
  barWidth: number;
  margin: number;
  fill?: string;
  className?: string;
}

export function MiddleCircle({ size, barWidth, margin, fill, className }: MiddleCircleProps) {
  const center = size / 2;
  const radius = (size - barWidth * 2) / 2 - margin;

  return <circle cx={center} cy={center} r={radius} fill={fill} className={className} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    vizWrapper: css({
      position: 'relative',
    }),
    innerShadow: css({
      filter: `drop-shadow(0px 0px 5px black);`,
    }),
  };
}

interface RadialSparklineProps {
  sparkline: FieldDisplay['sparkline'];
  size: number;
  theme: GrafanaTheme2;
  barWidth: number;
}

function RadialSparkline({ sparkline, size, theme, barWidth }: RadialSparklineProps) {
  if (!sparkline) {
    return null;
  }

  const height = size / 5;
  const width = size / 1.5 - barWidth * 1.2;
  const styles = css({
    position: 'absolute',
    left: (size - width) / 2,
    bottom: height,
  });

  const config: FieldConfig<GraphFieldConfig> = {
    custom: {
      gradientMode: GraphGradientMode.Opacity,
      fillOpacity: 50,
      lineInterpolation: LineInterpolation.Smooth,
    },
  };

  return (
    <div className={styles}>
      <Sparkline height={50} width={width} sparkline={sparkline} theme={theme} config={config} />
    </div>
  );
}
