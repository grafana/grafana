import { css } from '@emotion/css';
import { isNumber } from 'lodash';
import { useId } from 'react';

import { FieldDisplay, getDisplayProcessor, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

import { RadialBar } from './RadialBar';
import { RadialBarSegmented } from './RadialBarSegmented';
import { RadialColorDefs } from './RadialColorDefs';
import { RadialSparkline } from './RadialSparkline';
import { RadialText } from './RadialText';
import { ThresholdsBar } from './ThresholdsBar';
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
  thresholdsBar?: boolean;
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

export type RadialGradientMode = 'none' | 'auto';
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
    segmentSpacing = 0.1,
    roundedBars = true,
    thresholdsBar = false,
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
    const dimensions = calculateDimensions(
      width,
      height,
      endAngle,
      glowBar,
      roundedBars,
      barWidthFactor,
      barIndex,
      thresholdsBar
    );

    const displayProcessor = getFieldDisplayProcessor(displayValue);
    const spotlightGradientId = `spotlight-${barIndex}-${gaugeId}`;
    const glowFilterId = `glow-${gaugeId}`;
    const colorDefs = new RadialColorDefs({
      gradient,
      fieldDisplay: displayValue,
      theme,
      dimensions,
      shape,
      gaugeId,
      displayProcessor,
    });

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
          glowFilter={`url(#${glowFilterId})`}
          segmentCount={segmentCount}
          segmentSpacing={segmentSpacing}
          colorDefs={colorDefs}
        />
      );
    } else {
      graphics.push(
        <RadialBar
          key={`radial-bar-${barIndex}-${gaugeId}`}
          dimensions={dimensions}
          colorDefs={colorDefs}
          angle={angle}
          angleRange={angleRange}
          startAngle={startAngle}
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

      if (thresholdsBar) {
        graphics.push(
          <ThresholdsBar
            key="thresholds-bar"
            dimensions={dimensions}
            fieldDisplay={displayValue}
            startAngle={startAngle}
            endAngle={endAngle}
            angleRange={angleRange}
            roundedBars={roundedBars}
            glowFilter={`url(#${glowFilterId})`}
            colorDefs={colorDefs}
          />
        );
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
      <svg width={width} height={height} role="img" aria-label={t('gauge.category-gauge', 'Gauge')}>
        <defs>{defs}</defs>
        {graphics}
      </svg>
      {sparklineElement}
    </div>
  );
}

function getFieldDisplayProcessor(displayValue: FieldDisplay) {
  if (displayValue.view && isNumber(displayValue.colIndex)) {
    const dp = displayValue.view.getFieldDisplayProcessor(displayValue.colIndex);
    if (dp) {
      return dp;
    }
  }

  return getDisplayProcessor();
}

function getStyles(theme: GrafanaTheme2) {
  return {
    vizWrapper: css({
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      // Adds subtle shadow in light themes to help bar stand out
      '.radial-arc-path': {
        filter: theme.isLight ? `drop-shadow(0px 0px 1px #888);` : '',
      },
    }),
  };
}
