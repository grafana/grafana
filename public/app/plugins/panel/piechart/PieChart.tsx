import { css, cx } from '@emotion/css';
import { localPoint } from '@visx/event';
import { RadialGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import Pie, { type PieArcDatum, type ProvidedProps } from '@visx/shape/lib/shapes/Pie';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import { type UseTooltipParams } from '@visx/tooltip/lib/hooks/useTooltip';
import { useCallback } from 'react';
import * as React from 'react';
import tinycolor from 'tinycolor2';

import {
  type FieldDisplay,
  FALLBACK_COLOR,
  formattedValueToString,
  type GrafanaTheme2,
  DataHoverClearEvent,
  DataHoverEvent,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type SortOrder, type VizTooltipOptions } from '@grafana/schema';
import {
  useTheme2,
  useStyles2,
  type SeriesTableRowProps,
  DataLinksContextMenu,
  type DataLinksMenuTriggerProps,
  SeriesTable,
  usePanelContext,
} from '@grafana/ui';
import { getTooltipContainerStyles, useComponentInstanceId } from '@grafana/ui/internal';

import { PieChartType, PieChartLabels } from './panelcfg.gen';
import { filterDisplayItems, sumDisplayItemsReducer } from './utils';

/**
 * @beta
 */
interface PieChartProps {
  height: number;
  width: number;
  fieldDisplayValues: FieldDisplay[];
  pieType: PieChartType;
  sort: SortOrder;
  highlightedTitle?: string;
  displayLabels?: PieChartLabels[];
  useGradients?: boolean; // not used?
  tooltipOptions: VizTooltipOptions;
  /**
   * Pre-computed gradient fills keyed by FieldDisplay object reference.
   * Using the object reference (instead of display.title) ensures uniqueness
   * even when multiple series share the same display name.
   * Computed once in PieChartPanel and shared with both the chart and legend.
   */
  gradientFills?: Map<FieldDisplay, string>;
}

export const PieChart = ({
  fieldDisplayValues,
  pieType,
  sort,
  width,
  height,
  highlightedTitle,
  displayLabels = [],
  tooltipOptions,
  gradientFills,
}: PieChartProps) => {
  const theme = useTheme2();
  const componentInstanceId = useComponentInstanceId('PieChart');
  const styles = useStyles2(getStyles);
  const tooltip = useTooltip<SeriesTableRowProps[]>();
  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  const filteredFieldDisplayValues = fieldDisplayValues.filter(filterDisplayItems);

  const getValue = (d: FieldDisplay) => d.display.numeric;
  const getGradientId = (color: string) => `${componentInstanceId}-${tinycolor(color).toHex()}`;
  const getGradientColor = (color: string) => {
    return `url(#${getGradientId(color)})`;
  };

  const showLabel = displayLabels.length > 0;
  const showTooltip = tooltipOptions.mode !== 'none' && tooltip.tooltipOpen;
  const total = filteredFieldDisplayValues.reduce(sumDisplayItemsReducer, 0);
  const layout = getPieLayout(width, height, pieType);
  const colors = [
    ...new Set(
      filteredFieldDisplayValues.map((fieldDisplayValue) => fieldDisplayValue.display.color ?? FALLBACK_COLOR)
    ),
  ];

  // gradientFills is pre-computed in PieChartPanel and shared with the legend
  // to guarantee consistent colors between slices and legend items.

  return (
    <div className={styles.container}>
      <svg width={layout.size} height={layout.size} ref={containerRef} style={{ overflow: 'visible' }}>
        <Group top={layout.position} left={layout.position}>
          {colors.map((color) => {
            return (
              <RadialGradient
                key={color}
                id={getGradientId(color)}
                from={getGradientColorFrom(color, theme)}
                to={getGradientColorTo(color, theme)}
                fromOffset={layout.gradientFromOffset}
                toOffset="1"
                gradientUnits="userSpaceOnUse"
                cx={0}
                cy={0}
                radius={layout.outerRadius}
              />
            );
          })}
          <Pie
            data={filteredFieldDisplayValues}
            pieValue={getValue}
            pieSortValues={() => 0}
            outerRadius={layout.outerRadius}
            innerRadius={layout.innerRadius}
            cornerRadius={3}
            padAngle={0.005}
          >
            {(pie) => (
              <>
                {pie.arcs.map((arc) => {
                  const color = arc.data.display.color ?? FALLBACK_COLOR;
                  const highlightState = getHighlightState(highlightedTitle, arc);
                  // In gradient mode use the pre-computed interpolated fill; otherwise
                  // fall back to the per-series radial gradient (existing behaviour).
                  // Items with a field-level color override are not in gradientFills —
                  // fall back to display.color (the override value) rather than FALLBACK_COLOR.
                  const fill = gradientFills
                    ? (gradientFills.get(arc.data) ?? arc.data.display.color ?? FALLBACK_COLOR)
                    : getGradientColor(color);

                  // Slice with no data links — render plain, no keyboard interaction.
                  if (!arc.data.hasLinks || !arc.data.getLinks) {
                    return (
                      <PieSlice
                        key={arc.index}
                        highlightState={highlightState}
                        tooltip={tooltip}
                        arc={arc}
                        pie={pie}
                        fill={fill}
                        tooltipOptions={tooltipOptions}
                        gradientFills={gradientFills}
                      />
                    );
                  }

                  // Slice with one or more data links — delegate the link semantics
                  // (single-link `<a>` vs. multi-link context menu) entirely to the
                  // shared `DataLinksContextMenu`. For the multi-link case, spread
                  // `triggerProps` onto the slice `<g>` so the SVG element itself
                  // is the keyboard-focusable trigger (Tab to focus, Enter/Space
                  // to open the menu, ARIA semantics handled in one place).
                  return (
                    <DataLinksContextMenu key={arc.index} links={arc.data.getLinks}>
                      {({ triggerProps, targetClassName }) => (
                        <PieSlice
                          highlightState={highlightState}
                          tooltip={tooltip}
                          arc={arc}
                          pie={pie}
                          fill={fill}
                          tooltipOptions={tooltipOptions}
                          gradientFills={gradientFills}
                          triggerProps={triggerProps}
                          triggerClassName={targetClassName}
                          ariaLabel={arc.data.display.title}
                        />
                      )}
                    </DataLinksContextMenu>
                  );
                })}
                {showLabel &&
                  pie.arcs.map((arc) => {
                    const highlightState = getHighlightState(highlightedTitle, arc);
                    // In gradient mode pick black or white based on WCAG contrast ratio
                    // so labels stay readable across the full color range of the gradient.
                    const fillForLabel = gradientFills?.get(arc.data);
                    const labelColor = fillForLabel
                      ? tinycolor
                          .mostReadable(fillForLabel, ['#ffffff', '#000000'], {
                            includeFallbackColors: true,
                          })
                          .toHexString()
                      : theme.colors.text.primary;
                    return (
                      <PieLabel
                        arc={arc}
                        key={arc.index}
                        highlightState={highlightState}
                        outerRadius={layout.outerRadius}
                        innerRadius={layout.innerRadius}
                        displayLabels={displayLabels}
                        total={total}
                        color={labelColor}
                      />
                    );
                  })}
              </>
            )}
          </Pie>
        </Group>
      </svg>
      {showTooltip ? (
        <TooltipInPortal
          key={Math.random()}
          top={tooltip.tooltipTop}
          className={styles.tooltipPortal}
          left={tooltip.tooltipLeft}
          unstyled={true}
          applyPositionStyle={true}
        >
          <SeriesTable series={tooltip.tooltipData!} />
        </TooltipInPortal>
      ) : null}
    </div>
  );
};

interface SliceProps {
  arc: PieArcDatum<FieldDisplay>;
  pie: ProvidedProps<FieldDisplay>;
  highlightState: HighLightState;
  fill: string;
  tooltip: UseTooltipParams<SeriesTableRowProps[]>;
  tooltipOptions: VizTooltipOptions;
  gradientFills?: Map<FieldDisplay, string>;
  /**
   * When the slice represents a multi-link data-links menu, these props are
   * spread on the SVG `<g>` so it becomes the keyboard-focusable trigger
   * (`role="button"`, `tabIndex={0}`, Enter/Space → open menu).
   *
   * For the single-link case the wrapping HTML `<a>` rendered by
   * `DataLinksContextMenu` already provides keyboard focus, so this is left
   * undefined and the `<g>` stays a pure presentational element.
   */
  triggerProps?: DataLinksMenuTriggerProps;
  /** Theme-aware focus-visible class supplied by `DataLinksContextMenu`. */
  triggerClassName?: string;
  /** Accessible name announced for the trigger (slice display title). */
  ariaLabel?: string;
}

function PieSlice({
  arc,
  pie,
  highlightState,
  fill,
  tooltip,
  tooltipOptions,
  gradientFills,
  triggerProps,
  triggerClassName,
  ariaLabel,
}: SliceProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { eventBus } = usePanelContext();

  const onMouseOut = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      eventBus?.publish({
        type: DataHoverClearEvent.type,
        payload: {
          raw: event,
          x: 0,
          y: 0,
          dataId: arc.data.display.title,
        },
      });
      tooltip.hideTooltip();
    },
    [eventBus, arc, tooltip]
  );

  const onMouseMoveOverArc = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      eventBus?.publish({
        type: DataHoverEvent.type,
        payload: {
          raw: event,
          x: 0,
          y: 0,
          dataId: arc.data.display.title,
        },
      });

      const owner = event.currentTarget.ownerSVGElement;

      if (owner) {
        const coords = localPoint(owner, event);
        tooltip.showTooltip({
          tooltipLeft: coords!.x,
          tooltipTop: coords!.y,
          tooltipData: getTooltipData(pie, arc, tooltipOptions, gradientFills),
        });
      }
    },
    [eventBus, arc, tooltip, pie, tooltipOptions, gradientFills]
  );

  const pieStyle = getSvgStyle(highlightState, styles);

  return (
    <g
      key={arc.data.display.title}
      className={cx(pieStyle, triggerClassName)}
      onMouseMove={tooltipOptions.mode !== 'none' ? onMouseMoveOverArc : undefined}
      onMouseOut={onMouseOut}
      data-testid={selectors.components.Panels.Visualization.PieChart.svgSlice}
      // `triggerProps` (when present) supplies role="button", tabIndex=0,
      // onClick (open menu), onKeyDown (Enter/Space → open menu), and
      // aria-haspopup. Spread last so consumers can override defaults.
      aria-label={ariaLabel}
      {...triggerProps}
    >
      <path d={pie.path({ ...arc })!} fill={fill} stroke={theme.colors.background.primary} strokeWidth={1} />
    </g>
  );
}

interface LabelProps {
  arc: PieArcDatum<FieldDisplay>;
  outerRadius: number;
  innerRadius: number;
  displayLabels: PieChartLabels[];
  highlightState: HighLightState;
  total: number;
  color: string;
}

function PieLabel({ arc, outerRadius, innerRadius, displayLabels, total, color, highlightState }: LabelProps) {
  const styles = useStyles2(getStyles);
  const labelRadius = innerRadius === 0 ? outerRadius / 6 : innerRadius;
  const [labelX, labelY] = getLabelPos(arc, outerRadius, labelRadius);
  const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.3;

  if (!hasSpaceForLabel) {
    return null;
  }

  let labelFontSize = displayLabels.includes(PieChartLabels.Name)
    ? Math.min(Math.max((outerRadius / 150) * 14, 12), 30)
    : Math.min(Math.max((outerRadius / 100) * 14, 12), 36);

  return (
    <g className={getSvgStyle(highlightState, styles)}>
      <text
        fill={color}
        x={labelX}
        y={labelY}
        dy=".33em"
        fontSize={labelFontSize}
        fontWeight={500}
        textAnchor="middle"
        pointerEvents="none"
      >
        {displayLabels.includes(PieChartLabels.Name) && (
          <tspan x={labelX} dy="1.2em">
            {arc.data.display.title}
          </tspan>
        )}
        {displayLabels.includes(PieChartLabels.Value) && (
          <tspan x={labelX} dy="1.2em">
            {formattedValueToString(arc.data.display)}
          </tspan>
        )}
        {displayLabels.includes(PieChartLabels.Percent) && (
          <tspan x={labelX} dy="1.2em">
            {((arc.data.display.numeric / total) * 100).toFixed(arc.data.field.decimals ?? 0) + '%'}
          </tspan>
        )}
      </text>
    </g>
  );
}

function getTooltipData(
  pie: ProvidedProps<FieldDisplay>,
  arc: PieArcDatum<FieldDisplay>,
  tooltipOptions: VizTooltipOptions,
  gradientFills?: Map<FieldDisplay, string>
) {
  if (tooltipOptions.mode === 'multi') {
    return pie.arcs
      .filter((pa) => {
        if (tooltipOptions.hideZeros && pa.value === 0) {
          return false;
        }

        const customConfig = pa.data.field.custom;
        return !customConfig?.hideFrom?.tooltip;
      })
      .map((pieArc) => {
        return {
          color: gradientFills?.get(pieArc.data) ?? pieArc.data.display.color ?? FALLBACK_COLOR,
          label: pieArc.data.display.title,
          value: formattedValueToString(pieArc.data.display),
          isActive: pieArc.index === arc.index,
        };
      });
  }
  return [
    {
      color: gradientFills?.get(arc.data) ?? arc.data.display.color ?? FALLBACK_COLOR,
      label: arc.data.display.title,
      value: formattedValueToString(arc.data.display),
    },
  ];
}

function getLabelPos(arc: PieArcDatum<FieldDisplay>, outerRadius: number, innerRadius: number) {
  const r = (outerRadius + innerRadius) / 2;
  const a = (+arc.startAngle + +arc.endAngle) / 2 - Math.PI / 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

/**
 * Compute a flat hex fill color for each slice when the "gradient" color scheme is active.
 *
 * Slices are ranked by their numeric value from largest (rank 0) to smallest
 * (rank N-1). The interpolation parameter t = rank / (N-1) linearly maps that
 * rank onto the [colorFrom, colorTo] range in RGB space:
 *   - largest slice  → colorFrom (t = 0)
 *   - smallest slice → colorTo   (t = 1)
 *   - intermediate   → RGB lerp between the two
 *
 * When there is only one slice it receives colorFrom exactly.
 * Duplicate values retain their relative order (stable sort).
 *
 * @returns A Map keyed by the `FieldDisplay` object reference → hex color string.
 *   Using the object reference as the key (instead of display.title) guarantees
 *   uniqueness even when multiple series share the same display name.
 */
export function computeGradientFills(
  items: FieldDisplay[],
  colorFrom: string,
  colorTo: string
): Map<FieldDisplay, string> {
  // Sort a copy by value descending to determine rank; original order is unchanged.
  const sorted = [...items].sort((a, b) => b.display.numeric - a.display.numeric);
  const n = sorted.length;
  const from = tinycolor(colorFrom).toRgb();
  const to = tinycolor(colorTo).toRgb();
  const fills = new Map<FieldDisplay, string>();

  for (let rank = 0; rank < n; rank++) {
    const item = sorted[rank];
    const t = n > 1 ? rank / (n - 1) : 0;
    const r = Math.round(from.r * (1 - t) + to.r * t);
    const g = Math.round(from.g * (1 - t) + to.g * t);
    const b = Math.round(from.b * (1 - t) + to.b * t);
    fills.set(item, tinycolor({ r, g, b }).toHexString());
  }

  return fills;
}

function getGradientColorFrom(color: string, theme: GrafanaTheme2) {
  return tinycolor(color)
    .darken(20 * (theme.isDark ? 1 : -0.7))
    .spin(4)
    .toRgbString();
}

function getGradientColorTo(color: string, theme: GrafanaTheme2) {
  return tinycolor(color)
    .darken(10 * (theme.isDark ? 1 : -0.7))
    .spin(-4)
    .toRgbString();
}

interface PieLayout {
  position: number;
  size: number;
  outerRadius: number;
  innerRadius: number;
  gradientFromOffset: number;
}

function getPieLayout(height: number, width: number, pieType: PieChartType, margin = 16): PieLayout {
  const size = Math.min(width, height);
  const outerRadius = (size - margin * 2) / 2;
  const donutThickness = pieType === PieChartType.Pie ? outerRadius : Math.max(outerRadius / 3, 20);
  const innerRadius = outerRadius - donutThickness;
  const centerOffset = (size - margin * 2) / 2;
  // for non donut pie charts shift gradient out a bit
  const gradientFromOffset = 1 - (outerRadius - innerRadius) / outerRadius;
  return {
    position: centerOffset + margin,
    size: size,
    outerRadius: outerRadius,
    innerRadius: innerRadius,
    gradientFromOffset: gradientFromOffset,
  };
}

enum HighLightState {
  Highlighted,
  Deemphasized,
  Normal,
}

function getHighlightState(highlightedTitle: string | undefined, arc: PieArcDatum<FieldDisplay>) {
  if (highlightedTitle) {
    if (highlightedTitle === arc.data.display.title) {
      return HighLightState.Highlighted;
    } else {
      return HighLightState.Deemphasized;
    }
  }
  return HighLightState.Normal;
}

function getSvgStyle(
  highlightState: HighLightState,
  styles: {
    svgArg: { normal: string; highlighted: string; deemphasized: string };
  }
) {
  switch (highlightState) {
    case HighLightState.Highlighted:
      return styles.svgArg.highlighted;
    case HighLightState.Deemphasized:
      return styles.svgArg.deemphasized;
    case HighLightState.Normal:
    default:
      return styles.svgArg.normal;
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    svgArg: {
      normal: css({
        [theme.transitions.handleMotion('no-preference')]: {
          transition: 'all 200ms ease-in-out',
        },
      }),
      highlighted: css({
        [theme.transitions.handleMotion('no-preference')]: {
          transition: 'all 200ms ease-in-out',
        },
        transform: 'scale3d(1.03, 1.03, 1)',
      }),
      deemphasized: css({
        [theme.transitions.handleMotion('no-preference')]: {
          transition: 'all 200ms ease-in-out',
        },
        fillOpacity: 0.5,
      }),
    },
    tooltipPortal: css(getTooltipContainerStyles(theme)),
  };
};
