import { css, cx } from '@emotion/css';
import { useId, ReactNode } from 'react';

import { DisplayValueAlignmentFactors, FALLBACK_COLOR, FieldDisplay, GrafanaTheme2, TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { getFormattedThresholds } from '../Gauge/utils';

import { RadialBar } from './RadialBar';
import { RadialBarSegmented } from './RadialBarSegmented';
import { RadialScaleLabels } from './RadialScaleLabels';
import { RadialSparkline } from './RadialSparkline';
import { RadialText } from './RadialText';
import { ThresholdsBar } from './ThresholdsBar';
import { buildGradientColors } from './colors';
import { GlowGradient, MiddleCircleGlow, SpotlightGradient } from './effects';
import { RadialShape, RadialTextMode } from './types';
import { calculateDimensions, getValueAngleForValue } from './utils';

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
  /** For data links */
  onClick?: React.MouseEventHandler<HTMLElement>;
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
    thresholdsBar = false,
    showScaleLabels = false,
    neutral,
    endpointMarker,
    onClick,
    values,
  } = props;
  const theme = useTheme2();
  const gaugeId = useId();
  const styles = useStyles2(getStyles);

  let effectiveTextMode = textMode;
  if (effectiveTextMode === 'auto') {
    effectiveTextMode = vizCount === 1 ? 'value' : 'value_and_name';
  }

  const startAngle = shape === 'gauge' ? 250 : 0;
  const endAngle = shape === 'gauge' ? 110 : 360;

  const defs: ReactNode[] = [];
  const graphics: ReactNode[] = [];
  let sparklineElement: ReactNode | null = null;

  for (let barIndex = 0; barIndex < values.length; barIndex++) {
    const displayValue = values[barIndex];
    const { startValueAngle, endValueAngle, angleRange } = getValueAngleForValue(
      displayValue,
      startAngle,
      endAngle,
      neutral
    );

    const gradientStops = gradient ? buildGradientColors(theme, displayValue) : undefined;
    const color = displayValue.display.color ?? FALLBACK_COLOR;
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
      defs.push(
        <SpotlightGradient
          key={spotlightGradientId}
          id={spotlightGradientId}
          angle={endValueAngle + startAngle}
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
          fieldDisplay={displayValue}
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
        graphics.push(<MiddleCircleGlow key="center-glow" gaugeId={gaugeId} color={color} dimensions={dimensions} />);
      }

      graphics.push(
        <RadialText
          key="radial-text"
          textMode={effectiveTextMode}
          displayValue={displayValue.display}
          dimensions={dimensions}
          theme={theme}
          valueManualFontSize={props.valueManualFontSize}
          nameManualFontSize={props.nameManualFontSize}
          shape={shape}
          sparkline={displayValue.sparkline}
        />
      );

      if (showScaleLabels || thresholdsBar) {
        const decimals = displayValue.field.decimals ?? 2;
        const thresholds = getFormattedThresholds(decimals, displayValue.field, theme);

        if (showScaleLabels) {
          graphics.push(
            <RadialScaleLabels
              key="radial-scale-labels"
              thresholds={thresholds}
              fieldDisplay={displayValue}
              angleRange={angleRange}
              theme={theme}
              dimensions={dimensions}
              startAngle={startAngle}
              endAngle={endAngle}
            />
          );
        }

        if (thresholdsBar) {
          graphics.push(
            <ThresholdsBar
              key="thresholds-bar"
              thresholds={thresholds}
              dimensions={dimensions}
              fieldDisplay={displayValue}
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

      if (displayValue.sparkline) {
        sparklineElement = (
          <RadialSparkline
            sparkline={displayValue.sparkline}
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

  const body = (
    <>
      <svg width={width} height={height} role="img" aria-label={t('gauge.category-gauge', 'Gauge')}>
        {defs.length > 0 && <defs>{defs}</defs>}
        {graphics}
      </svg>
      {sparklineElement}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={cx(styles.clearButton, styles.vizWrapper)} style={{ width, height }}>
        {body}
      </button>
    );
  }

  return (
    <div
      data-testid={selectors.components.Panels.Visualization.Gauge.Container}
      className={styles.vizWrapper}
      style={{ width, height }}
    >
      {body}
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
    clearButton: css({
      background: 'transparent',
      color: theme.colors.text.primary,
      border: 'none',
      padding: 0,
      cursor: 'context-menu',
    }),
  };
}
