import { css } from '@emotion/css';
import { useId } from 'react';

import { DisplayValue, FieldConfig, FieldDisplay, GrafanaTheme2 } from '@grafana/data';
import { GraphFieldConfig, GraphGradientMode, LineInterpolation } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { Sparkline } from '../Sparkline/Sparkline';

import { GradientDef, getGradientId } from './GradientDef';
import { RadialText } from './RadialText';
import { CenterGlowGradient, GlowGradient, SpotlightGradient } from './effects';

export interface RadialGaugeProps {
  values: FieldDisplay[];
  width: number;
  height: number;
  shape?: RadialShape;
  gradient?: RadialGradientMode;
  barWidthFactor?: number;
  clockwise?: boolean;
  /** Adds a white spotlight for the end position */
  spotlight?: boolean;
  glowBar?: boolean;
  glowCenter?: boolean;
  textMode?: RadialTextMode;
  /**
   * If multiple is shown in a group (via VizRepeater).
   * This impacts the auto textMode
   */
  vizCount?: number; // Not implemented yet
}

export type RadialGradientMode = 'none' | 'scheme' | 'hue' | 'shade';
export type RadialTextMode = 'auto' | 'value_and_name' | 'value' | 'name' | 'none';
export type RadialShape = 'circle' | 'gauge';

export function RadialGauge(props: RadialGaugeProps) {
  const {
    width = 256,
    height = 256,
    shape = 'circle',
    gradient = 'none',
    barWidthFactor = 0.4,
    clockwise = true,
    spotlight = false,
    glowBar = false,
    glowCenter = false,
    textMode = 'auto',
    vizCount = 1,
    values,
  } = props;
  const theme = useTheme2();
  const gaugeId = useId();
  const styles = useStyles2(getStyles);
  const size = Math.min(width, height);

  let startAngle = shape === 'gauge' ? 240 : 0;
  let endAngle = shape === 'gauge' ? 120 : 360;

  const margin = calculateMargin(size, glowBar, spotlight, barWidthFactor);
  const color = values[0]?.display.color ?? theme.colors.primary.main;
  const primaryValue = values[0];
  const barWidth = Math.max(barWidthFactor * (size / 7), 2);

  return (
    <div className={styles.vizWrapper} style={{ width, height }}>
      <svg width={size} height={size}>
        <defs>
          {values.map((displayValue, barIndex) => (
            <GradientDef
              key={barIndex}
              fieldDisplay={displayValue}
              index={barIndex}
              theme={theme}
              gaugeId={gaugeId}
              gradient={gradient}
            />
          ))}
          {spotlight && <SpotlightGradient gaugeId={gaugeId} />}
          {glowBar && <GlowGradient gaugeId={gaugeId} size={size} />}
          {glowCenter && <CenterGlowGradient gaugeId={gaugeId} color={color} />}
        </defs>
        <g>
          {values.map((displayValue, barIndex) => {
            const value = displayValue.display.numeric;
            const min = displayValue.field.min ?? 0;
            const max = displayValue.field.max ?? 100;
            const barColor = getColorForBar(displayValue.display, barIndex, gradient, gaugeId);
            const barSize = size - (barWidth * 2 + 8) * barIndex;
            const center = size / 2;

            return (
              <RadialBar
                margin={margin}
                key={barIndex}
                center={center}
                gaugeId={gaugeId}
                value={value}
                min={min}
                max={max}
                startAngle={startAngle}
                endAngle={endAngle}
                size={barSize}
                color={barColor}
                barWidth={barWidth}
                roundedBars={true}
                clockwise={clockwise}
                spotlight={spotlight}
                glow={glowBar}
              />
            );
          })}
        </g>
        <g>
          {glowCenter && (
            <MiddleCircle barWidth={barWidth} fill={`url(#circle-glow-${gaugeId})`} size={size} margin={margin} />
          )}
          {primaryValue && (
            <RadialText
              vizCount={vizCount}
              textMode={textMode}
              displayValue={primaryValue.display}
              size={size}
              theme={theme}
            />
          )}
        </g>
      </svg>
      {primaryValue && primaryValue.sparkline && (
        <RadialSparkline
          sparkline={primaryValue.sparkline}
          size={size}
          theme={theme}
          barWidth={barWidth}
          margin={margin}
        />
      )}
    </div>
  );
}

function calculateMargin(
  size: number,
  glow: boolean | undefined,
  spotlight: boolean | undefined,
  barWidth: number
): number {
  if (glow) {
    return 0.035 * size;
  }

  if (spotlight) {
    return barWidth / 4;
  }

  return 0;
}

function getColorForBar(displayValue: DisplayValue, barIndex: number, gradient: RadialGradientMode, gaugeId: string) {
  if (gradient === 'none') {
    return displayValue.color ?? 'gray';
  }

  return `url(#${getGradientId(gaugeId, barIndex)})`;
}

export interface RadialBarProps {
  gaugeId: string;
  value: number;
  center: number;
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

function RadialBar({
  center,
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
  let angle = ((value - min) / (max - min)) * range;

  if (angle > range) {
    angle = range;
  }

  if (!clockwise) {
    startAngle = endAngle - angle;
  }

  const trackStart = startAngle + angle;
  const trackLength = range - angle;

  return (
    <>
      {/** Track */}
      <RadialArcPath
        gaugeId={gaugeId}
        angle={trackLength}
        center={center}
        size={size}
        startAngle={trackStart}
        color={theme.colors.action.hover}
        barWidth={barWidth}
        roundedBars={roundedBars}
        clockwise={clockwise}
        margin={margin}
      />
      {/** The colored bar */}
      <RadialArcPath
        gaugeId={gaugeId}
        angle={angle}
        center={center}
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
  center: number;
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
  center,
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
  const arcSize = size - barWidth;
  const radius = arcSize / 2 - margin;

  let startDeg = startAngle;
  let endDeg = angle + startAngle;

  if (endDeg - startDeg === 360) {
    startDeg += 0.01;
  }

  let startRadians = (Math.PI * (startDeg - 90)) / 180;
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
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
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
  margin: number;
}

function RadialSparkline({ sparkline, size, theme, barWidth, margin }: RadialSparklineProps) {
  if (!sparkline) {
    return null;
  }

  const height = size / 8;
  const width = size / 1.5 - barWidth * 1.2 - margin * 2;
  const styles = css({
    position: 'absolute',
    marginTop: size / 2 - barWidth * 1.5 + height / 3,
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
      <Sparkline height={height} width={width} sparkline={sparkline} theme={theme} config={config} />
    </div>
  );
}
