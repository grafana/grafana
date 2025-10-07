import { css } from '@emotion/css';
import { isNumber } from 'lodash';
import { useId } from 'react';

import { FieldDisplay, getDisplayProcessor, GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

import { GradientDef } from './GradientDef';
import { RadialBar } from './RadialBar';
import { RadialBarSegmented } from './RadialBarSegmented';
import { RadialSparkline } from './RadialSparkline';
import { RadialText } from './RadialText';
import { GlowGradient, MiddleCircleGlow, SpotlightGradient } from './effects';
import { calculateDimensions, getValueAngleForValue } from './utils';

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

  const defs: React.ReactNode[] = [];
  const graphics: React.ReactNode[] = [];
  let sparklineElement: React.ReactNode | null = null;

  for (let barIndex = 0; barIndex < values.length; barIndex++) {
    const displayValue = values[barIndex];
    const { angle, angleRange } = getValueAngleForValue(displayValue, startAngle, endAngle);
    const color = displayValue.display.color ?? 'gray';
    const dimensions = calculateDimensions(width, height, endAngle, glowBar, roundedBars, barWidthFactor, barIndex);

    let displayProcessor = getDisplayProcessor();

    if (displayValue.view && isNumber(displayValue.colIndex)) {
      displayProcessor = displayValue.view.getFieldDisplayProcessor(displayValue.colIndex) ?? displayProcessor;
    }

    const spotlightGradientId = `spotlight-${barIndex}-${gaugeId}`;
    const glowFilterId = `glow-${gaugeId}`;
    const colorGradientId = `bar-color-${barIndex}-${gaugeId}`;
    const barColor = gradient !== 'none' ? `url(#${colorGradientId})` : color;

    defs.push(
      <GradientDef
        key={`gradient-${barIndex}`}
        fieldDisplay={displayValue}
        id={colorGradientId}
        theme={theme}
        gradient={gradient}
        dimensions={dimensions}
        shape={shape}
      />
    );

    if (spotlight) {
      defs.push(
        <SpotlightGradient
          key={spotlightGradientId}
          id={spotlightGradientId}
          angle={angle + startAngle}
          dimensions={dimensions}
          roundedBars={roundedBars}
          theme={theme}
        />
      );
    }

    if (segmentCount > 1) {
      graphics.push(
        <RadialBarSegmented
          key={`radial-bar-segmented-${barIndex}-${gaugeId}`}
          dimensions={dimensions}
          fieldDisplay={displayValue}
          angleRange={angleRange}
          startAngle={startAngle}
          color={barColor}
          glowFilter={`url(#${glowFilterId})`}
          segmentCount={segmentCount}
          segmentSpacing={segmentSpacing}
          displayProcessor={displayProcessor}
          gradient={gradient}
        />
      );
    } else {
      graphics.push(
        <RadialBar
          key={`radial-bar-${barIndex}-${gaugeId}`}
          dimensions={dimensions}
          angle={angle}
          angleRange={angleRange}
          startAngle={startAngle}
          color={barColor}
          roundedBars={roundedBars}
          spotlightStroke={`url(#${spotlightGradientId})`}
          glowFilter={`url(#${glowFilterId})`}
        />
      );
    }

    // These elements are only added for first value / bar

    if (barIndex === 0) {
      if (glowBar) {
        defs.push(<GlowGradient key="glow-filter" id={glowFilterId} radius={dimensions.radius} />);
      }

      if (glowCenter) {
        graphics.push(<MiddleCircleGlow key="center-glow" gaugeId={gaugeId} color={color} dimensions={dimensions} />);
      }

      graphics.push(
        <RadialText
          key="radial-text"
          vizCount={vizCount}
          textMode={textMode}
          displayValue={displayValue.display}
          dimensions={dimensions}
          theme={theme}
          shape={shape}
        />
      );

      if (displayValue.sparkline) {
        sparklineElement = (
          <RadialSparkline
            sparkline={displayValue.sparkline}
            dimensions={dimensions}
            theme={theme}
            color={color}
            shape={shape}
          />
        );
      }
    }
  }

  return (
    <div className={styles.vizWrapper} style={{ width, height }}>
      <svg width={width} height={height}>
        <defs>{defs}</defs>
        {graphics}
      </svg>
      {sparklineElement}
    </div>
  );
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
