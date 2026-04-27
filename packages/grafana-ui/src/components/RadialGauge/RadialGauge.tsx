import { useId, type ReactNode } from 'react';

import type { FieldDisplay } from '@grafana/data/field';
import { type DisplayValueAlignmentFactors, FALLBACK_COLOR, ThresholdsMode, type TimeRange } from '@grafana/data/types';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Box } from '../Layout/Box/Box';

import { RadialBar } from './RadialBar';
import { RadialBarSegmented } from './RadialBarSegmented';
import { RadialScaleLabels } from './RadialScaleLabels';
import { RadialSparkline } from './RadialSparkline';
import { RadialText } from './RadialText';
import { ThresholdsBar } from './ThresholdsBar';
import { buildGradientColors, colorAtGradientPercent } from './colors';
import { ARC_END, ARC_START, DEFAULT_DECIMALS } from './constants';
import { GlowGradient, MiddleCircleGlow, SpotlightGradient } from './effects';
import { type RadialShape, type RadialTextMode } from './types';
import { calculateDimensions, getValueAngleForValue, getFormattedThresholds } from './utils';

export interface RadialGaugeProps {
  values: FieldDisplay[];
  width: number;
  height: number;
  /**
   * Circle or gauge (partial circle)
   */
  shape?: RadialShape;
  gradient?: boolean;
  /**
   * Bar width is always relative to size of the gauge.
   * But this gives you control over the width relative to size.
   * Range 0 - 1 (1 being the thickest)
   * Defaults to 0.4
   **/
  barWidthFactor?: number;
  glowBar?: boolean;
  glowCenter?: boolean;
  roundedBars?: boolean;
  thresholdsBar?: boolean;
  /**
   * Specify if an endpoint marker should be shown at the end of the bar
   */
  endpointMarker?: 'point' | 'glow';
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
  vizCount?: number;
  /** Factors that should influence the positioning of the text  */
  alignmentFactors?: DisplayValueAlignmentFactors;
  /** Explicit font size control */
  valueManualFontSize?: number;
  /** Explicit font size control */
  nameManualFontSize?: number;
  /** Specify which text should be visible  */
  textMode?: RadialTextMode;
  showScaleLabels?: boolean;
  /**
   * If set, the gauge will use the neutral value instead of the min value as the starting point for a gauge.
   * this is most useful when you need to show positive and negative values on a gauge.
   */
  neutral?: number;
  timeRange?: TimeRange;
}

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/plugins-radialgauge--docs
 */
export function RadialGauge(props: RadialGaugeProps) {
  const {
    width = 256,
    height = 256,
    shape = 'circle',
    gradient = false,
    barWidthFactor = 0.4,
    glowBar = false,
    glowCenter = false,
    textMode = 'auto',
    vizCount = 1,
    segmentCount = 0,
    segmentSpacing = 0.1,
    roundedBars = true,
    thresholdsBar: rawThresholdsBar = false,
    showScaleLabels = false,
    neutral,
    endpointMarker,
    values,
  } = props;
  const theme = useTheme2();
  const gaugeId = useId();

  let effectiveTextMode = textMode;
  if (effectiveTextMode === 'auto') {
    const firstValue: FieldDisplay | undefined = values[0];
    // in auto mode, we should show value_and_name if there are multiple values or the first value has a display name
    effectiveTextMode = vizCount > 1 || firstValue?.field?.displayName != null ? 'value_and_name' : 'value';
  }

  const startAngle = shape === 'gauge' ? ARC_START : 0;
  const endAngle = shape === 'gauge' ? ARC_END : 360;

  const defs: ReactNode[] = [];
  const graphics: ReactNode[] = [];
  let sparklineElement: ReactNode | null = null;

  for (let barIndex = 0; barIndex < values.length; barIndex++) {
    const fieldDisplay = values[barIndex];

    // if min === max, the min and max thresholds will also be equal, which causes visual bugs.
    const thresholdsBar = rawThresholdsBar && fieldDisplay.field.min !== fieldDisplay.field.max;
    const { startValueAngle, endValueAngle, angleRange } = getValueAngleForValue(
      fieldDisplay,
      startAngle,
      endAngle,
      neutral
    );

    const gradientStops = gradient ? buildGradientColors(theme, fieldDisplay) : undefined;
    const color = fieldDisplay.display.color ?? FALLBACK_COLOR;
    const dimensions = calculateDimensions(
      width,
      height,
      endAngle,
      glowBar,
      roundedBars,
      barWidthFactor,
      barIndex,
      thresholdsBar,
      showScaleLabels
    );

    // FIXME: I want to move the ids for these filters into a context which the children
    // can reference via a hook, rather than passing them down as props
    const spotlightGradientId = `spotlight-${barIndex}-${gaugeId}`;
    const spotlightGradientRef = endpointMarker === 'glow' ? `url(#${spotlightGradientId})` : undefined;
    const glowFilterId = `glow-${gaugeId}`;
    const glowFilterRef = glowBar ? `url(#${glowFilterId})` : undefined;

    if (endpointMarker === 'glow') {
      const endpointColor = gradientStops
        ? colorAtGradientPercent(gradientStops, fieldDisplay.display.percent ?? 1).toHexString()
        : color;
      defs.push(
        <SpotlightGradient
          key={spotlightGradientId}
          id={spotlightGradientId}
          angle={endValueAngle + startAngle}
          dimensions={dimensions}
          roundedBars={roundedBars}
          theme={theme}
          color={endpointColor}
        />
      );
    }

    if (segmentCount > 1) {
      graphics.push(
        <RadialBarSegmented
          key={`radial-bar-segmented-${barIndex}-${gaugeId}`}
          dimensions={dimensions}
          fieldDisplay={fieldDisplay}
          angleRange={angleRange}
          startAngle={startAngle}
          startValueAngle={startValueAngle}
          endValueAngle={endValueAngle}
          glowFilter={glowFilterRef}
          segmentCount={segmentCount}
          segmentSpacing={segmentSpacing}
          shape={shape}
          gradient={gradientStops}
        />
      );
    } else {
      graphics.push(
        <RadialBar
          key={`radial-bar-${barIndex}-${gaugeId}`}
          dimensions={dimensions}
          angleRange={angleRange}
          startAngle={startAngle}
          startValueAngle={startValueAngle}
          endValueAngle={endValueAngle}
          roundedBars={roundedBars}
          glowFilter={glowFilterRef}
          endpointMarkerGlowFilter={spotlightGradientRef}
          shape={shape}
          gradient={gradientStops}
          fieldDisplay={fieldDisplay}
          endpointMarker={endpointMarker}
        />
      );
    }

    // These elements are only added for first value / bar
    if (barIndex === 0) {
      if (glowBar) {
        defs.push(<GlowGradient key={glowFilterId} id={glowFilterId} barWidth={dimensions.barWidth} />);
      }

      if (glowCenter) {
        graphics.push(
          <MiddleCircleGlow key="center-glow" gaugeId={gaugeId} color={color} dimensions={dimensions} shape={shape} />
        );
      }

      graphics.push(
        <RadialText
          key="radial-text"
          textMode={effectiveTextMode}
          displayValue={fieldDisplay.display}
          dimensions={dimensions}
          theme={theme}
          valueManualFontSize={props.valueManualFontSize}
          nameManualFontSize={props.nameManualFontSize}
          shape={shape}
          sparkline={fieldDisplay.sparkline}
        />
      );

      if (showScaleLabels || thresholdsBar) {
        const thresholds = getFormattedThresholds(
          fieldDisplay.field.decimals ?? DEFAULT_DECIMALS,
          fieldDisplay.field,
          theme
        );

        if (showScaleLabels) {
          graphics.push(
            <RadialScaleLabels
              key="radial-scale-labels"
              thresholds={thresholds}
              thresholdsMode={fieldDisplay.field.thresholds?.mode ?? ThresholdsMode.Absolute}
              fieldDisplay={fieldDisplay}
              angleRange={angleRange}
              theme={theme}
              dimensions={dimensions}
              startAngle={startAngle}
              neutral={neutral}
            />
          );
        }

        if (thresholdsBar) {
          graphics.push(
            <ThresholdsBar
              key="thresholds-bar"
              thresholds={thresholds}
              thresholdsMode={fieldDisplay.field.thresholds?.mode}
              dimensions={dimensions}
              fieldDisplay={fieldDisplay}
              startAngle={startAngle}
              endAngle={endAngle}
              angleRange={angleRange}
              roundedBars={roundedBars}
              glowFilter={glowFilterRef}
              shape={shape}
              gradient={gradientStops}
            />
          );
        }
      }

      if (fieldDisplay.sparkline) {
        sparklineElement = (
          <RadialSparkline
            sparkline={fieldDisplay.sparkline}
            dimensions={dimensions}
            theme={theme}
            color={color}
            shape={shape}
            textMode={effectiveTextMode}
          />
        );
      }
    }
  }

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      position="relative"
      data-testid={selectors.components.Panels.Visualization.Gauge.Container}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={t('gauge.category-gauge', 'Gauge')}
      >
        {defs.length > 0 && <defs>{defs}</defs>}
        {graphics}
      </svg>
      {sparklineElement}
    </Box>
  );
}
