import { css } from '@emotion/css';
import { isNumber } from 'lodash';
import { useId } from 'react';

import { DisplayValue, FieldDisplay, getDisplayProcessor, GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

import { GradientDef, getGradientId } from './GradientDef';
import { RadialBar } from './RadialBar';
import { RadialBarSegmented } from './RadialBarSegmented';
import { RadialSparkline } from './RadialSparkline';
import { RadialText } from './RadialText';
import { CenterGlowGradient, GlowGradient, SpotlightGradient } from './effects';
import { getValueAngleForValue } from './utils';

export interface RadialGaugeProps {
  values: FieldDisplay[];
  width: number;
  height: number;
  /**
   * Circle or gauge (partial circle)
   */
  shape?: RadialShape;
  gradient?: RadialGradientMode;
  /**
   * Bar width is always relative to size of the gauge.
   * But this gives you control over the width relative to size.
   * Range 0 - 1 (1 being the thickest)
   * Defaults to 0.4
   **/
  barWidthFactor?: number;
  /** Adds a white spotlight for the end position */
  spotlight?: boolean;
  glowBar?: boolean;
  glowCenter?: boolean;
  roundedBars?: boolean;
  textMode?: RadialTextMode;
  /**
   * Number of segments depends on size of gauge but this
   * factor 1-10 gives you relative control
   **/
  segmentCount?: number;
  /**
   * Distance between segments
   * Factor between 0-1
   */
  segmentSpacing?: number;
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
    spotlight = false,
    glowBar = false,
    glowCenter = false,
    textMode = 'auto',
    vizCount = 1,
    segmentCount = 0,
    segmentSpacing = 0,
    roundedBars = true,
    values,
  } = props;
  const theme = useTheme2();
  const gaugeId = useId();
  const styles = useStyles2(getStyles);

  const startAngle = shape === 'gauge' ? 250 : 0;
  const endAngle = shape === 'gauge' ? 110 : 360;

  const { svgHeight, svgWidth, margin, size } = calculateDimensions(
    width,
    height,
    shape,
    glowBar,
    spotlight,
    barWidthFactor
  );

  const primaryValue = values[0];
  const color = primaryValue.display.color ?? theme.colors.primary.main;
  const barWidth = Math.max(barWidthFactor * (size / 7), 2);
  const innerDiameter = size - barWidth - margin;
  const radius = innerDiameter / 2;
  const center = size / 2;

  const { angle } = getValueAngleForValue(primaryValue, startAngle, endAngle);

  return (
    <div className={styles.vizWrapper} style={{ width, height }}>
      <svg width={svgWidth} height={svgHeight}>
        <defs>
          {values.map((displayValue, barIndex) => (
            <GradientDef
              key={barIndex}
              fieldDisplay={displayValue}
              index={barIndex}
              theme={theme}
              gaugeId={gaugeId}
              gradient={gradient}
              width={svgWidth}
              height={height}
              shape={shape}
              center={center}
              radius={radius}
              barWidth={barWidth}
            />
          ))}
          {spotlight && (
            <SpotlightGradient
              angle={angle + startAngle}
              gaugeId={gaugeId}
              radius={radius}
              roundedBars={roundedBars}
              center={center}
              theme={theme}
            />
          )}
          {glowBar && <GlowGradient gaugeId={gaugeId} size={size} />}
          {glowCenter && <CenterGlowGradient gaugeId={gaugeId} color={color} />}
        </defs>
        <g>
          {values.map((displayValue, barIndex) => {
            const barColor = getColorForBar(displayValue.display, barIndex, gradient, gaugeId);
            const barSize = size - (barWidth * 2 + 8) * barIndex;

            let displayProcessor = getDisplayProcessor();

            if (displayValue.view && isNumber(displayValue.colIndex)) {
              displayProcessor = displayValue.view.getFieldDisplayProcessor(displayValue.colIndex) ?? displayProcessor;
            }

            if (segmentCount > 1) {
              return (
                <RadialBarSegmented
                  margin={margin}
                  key={barIndex}
                  center={center}
                  gaugeId={gaugeId}
                  fieldDisplay={displayValue}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  size={barSize}
                  color={barColor}
                  barWidth={barWidth}
                  spotlight={spotlight}
                  glow={glowBar}
                  segmentCount={segmentCount}
                  segmentSpacing={segmentSpacing}
                  displayProcessor={displayProcessor}
                  gradient={gradient}
                />
              );
            }

            return (
              <RadialBar
                margin={margin}
                key={barIndex}
                center={center}
                gaugeId={gaugeId}
                fieldDisplay={displayValue}
                startAngle={startAngle}
                endAngle={endAngle}
                size={barSize}
                color={barColor}
                barWidth={barWidth}
                roundedBars={roundedBars}
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
              shape={shape}
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
          color={color}
          shape={shape}
        />
      )}
    </div>
  );
}

function calculateDimensions(
  width: number,
  height: number,
  shape: RadialShape,
  glow: boolean | undefined,
  spotlight: boolean | undefined,
  barWidth: number
): { svgWidth: number; svgHeight: number; margin: number; size: number } {
  let margin = 0;
  let svgWidth = width;
  let svgHeight = height;
  let size = Math.min(width, height);

  if (glow) {
    margin = 0.035 * width;
  }

  if (shape === 'gauge') {
  }

  return { svgWidth, svgHeight, margin, size };
}

function getColorForBar(displayValue: DisplayValue, barIndex: number, gradient: RadialGradientMode, gaugeId: string) {
  if (gradient === 'none') {
    return displayValue.color ?? 'gray';
  }

  return `url(#${getGradientId(gaugeId, barIndex)})`;
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
