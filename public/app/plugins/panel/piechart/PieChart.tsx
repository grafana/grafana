import { css } from '@emotion/css';
import { localPoint } from '@visx/event';
import { RadialGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import Pie, { PieArcDatum, ProvidedProps } from '@visx/shape/lib/shapes/Pie';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import { UseTooltipParams } from '@visx/tooltip/lib/hooks/useTooltip';
import { useCallback, useRef, useEffect } from 'react';
import * as React from 'react';
import tinycolor from 'tinycolor2';

import {
  FieldDisplay,
  FALLBACK_COLOR,
  formattedValueToString,
  GrafanaTheme2,
  DataHoverClearEvent,
  DataHoverEvent,
  LinkModel,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { SortOrder, VizTooltipOptions } from '@grafana/schema';
import {
  useTheme2,
  useStyles2,
  SeriesTableRowProps,
  DataLinksContextMenu,
  SeriesTable,
  usePanelContext,
} from '@grafana/ui';
import { type DataLinksContextMenuApi, getTooltipContainerStyles, useComponentInstanceId } from '@grafana/ui/internal';

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

                    if (arc.data.hasLinks && arc.data.getLinks) {
                      return (
                        <PieSliceWithDataLinks
                          key={arc.index}
                          arc={arc}
                          pie={pie}
                          highlightState={highlightState}
                          fill={getGradientColor(color)}
                          tooltip={tooltip}
                          tooltipOptions={tooltipOptions}
                          outerRadius={layout.outerRadius}
                          innerRadius={layout.innerRadius}
                          links={arc.data.getLinks}
                        />
                      );
                    } else {
                      return (
                        <PieSlice
                          key={arc.index}
                          highlightState={highlightState}
                          tooltip={tooltip}
                          arc={arc}
                          pie={pie}
                          fill={getGradientColor(color)}
                          tooltipOptions={tooltipOptions}
                          outerRadius={layout.outerRadius}
                          innerRadius={layout.innerRadius}
                        />
                      );
                    }
                  })}
                {showLabel &&
                  pie.arcs.map((arc) => {
                    const highlightState = getHighlightState(highlightedTitle, arc);
                    return (
                      <PieLabel
                        arc={arc}
                        key={arc.index}
                        highlightState={highlightState}
                        outerRadius={layout.outerRadius}
                        innerRadius={layout.innerRadius}
                        displayLabels={displayLabels}
                        total={total}
                        color={theme.colors.text.primary}
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
  openMenu?: DataLinksContextMenuApi['openMenu'];
  outerRadius: number;
  innerRadius: number;
}

interface PieSliceWithDataLinksProps extends Omit<SliceProps, 'openMenu'> {
  links: () => LinkModel[];
}


/**
 * Component that wraps PieSlice with DataLinksContextMenu and handles event listeners
 * for the anchor element. This keeps event handler logic co-located with component creation.
 */
function PieSliceWithDataLinks({
  arc,
  pie,
  highlightState,
  fill,
  tooltip,
  tooltipOptions,
  outerRadius,
  innerRadius,
  links,
}: PieSliceWithDataLinksProps) {
  const { eventBus } = usePanelContext();
  const elementRef = useRef<SVGGElement>(null);

  const publishDataHoverEvent = useCallback(
    (raw: Event | React.SyntheticEvent) => {
      eventBus?.publish({
        type: DataHoverEvent.type,
        payload: {
          raw,
          x: 0,
          y: 0,
          dataId: arc.data.display.title,
        },
      });
    },
    [eventBus, arc.data.display.title]
  );

  const publishDataHoverClearEvent = useCallback(
    (raw: Event | React.SyntheticEvent) => {
      eventBus?.publish({
        type: DataHoverClearEvent.type,
        payload: {
          raw,
          x: 0,
          y: 0,
          dataId: arc.data.display.title,
        },
      });
    },
    [eventBus, arc.data.display.title]
  );

  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  // Use ref callback to get anchor element directly when it's created (single-link case)
  const handleAnchorRef = useCallback(
    (element: HTMLAnchorElement | null) => {
      anchorRef.current = element;

      if (element) {
        // Ensure anchor is focusable
        if (element.getAttribute('tabIndex') === '-1') {
          element.removeAttribute('tabIndex');
        }

        // Ensure SVG element is not focusable
        if (elementRef.current) {
          const ensureNotFocusable = () => {
            if (elementRef.current && elementRef.current.getAttribute('tabIndex') !== '-1') {
              elementRef.current.setAttribute('tabIndex', '-1');
            }
          };
          ensureNotFocusable();
          setTimeout(ensureNotFocusable, 0);
        }
      }
    },
    [elementRef]
  );

  const handleAnchorFocus = useCallback(
    (event: React.FocusEvent<HTMLAnchorElement>) => {
      publishDataHoverEvent(event.nativeEvent);
    },
    [publishDataHoverEvent]
  );

  const handleAnchorBlur = useCallback(
    (event: React.FocusEvent<HTMLAnchorElement>) => {
      publishDataHoverClearEvent(event.nativeEvent);
    },
    [publishDataHoverClearEvent]
  );

  const handleAnchorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLAnchorElement>) => {
      if (event.key === 'Tab' && elementRef.current) {
        elementRef.current.setAttribute('tabIndex', '-1');
      }
      // Handle focusin events - redirect focus to anchor if a child receives focus
      const target = event.target;
      if (target instanceof Element && target !== anchorRef.current && anchorRef.current?.contains(target)) {
        event.stopPropagation();
        anchorRef.current?.focus();
      }
    },
    [elementRef]
  );

  return (
    <DataLinksContextMenu
      links={links}
      anchorRef={handleAnchorRef}
      onAnchorFocus={handleAnchorFocus}
      onAnchorBlur={handleAnchorBlur}
      onAnchorKeyDown={handleAnchorKeyDown}
    >
      {(api) => (
        <PieSlice
          tooltip={tooltip}
          highlightState={highlightState}
          arc={arc}
          pie={pie}
          fill={fill}
          openMenu={api.openMenu}
          tooltipOptions={tooltipOptions}
          outerRadius={outerRadius}
          innerRadius={innerRadius}
          elementRef={elementRef}
        />
      )}
    </DataLinksContextMenu>
  );
}

function PieSlice({
  arc,
  pie,
  highlightState,
  openMenu,
  fill,
  tooltip,
  tooltipOptions,
  outerRadius,
  innerRadius,
  elementRef: externalElementRef,
}: SliceProps & { elementRef?: React.RefObject<SVGGElement> }) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { eventBus } = usePanelContext();
  const internalElementRef = useRef<SVGGElement>(null);
  const elementRef = externalElementRef || internalElementRef;
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasDataLinksDirect = Boolean(arc.data.hasLinks && arc.data.getLinks);
  const hasDataLinks = Boolean(openMenu) || hasDataLinksDirect;
  const shouldBeFocusable = hasDataLinks && Boolean(openMenu);

  const publishDataHoverEvent = useCallback(
    (raw: Event | React.SyntheticEvent) => {
      eventBus?.publish({
        type: DataHoverEvent.type,
        payload: {
          raw,
          x: 0,
          y: 0,
          dataId: arc.data.display.title,
        },
      });
    },
    [eventBus, arc.data.display.title]
  );

  const publishDataHoverClearEvent = useCallback(
    (raw: Event | React.SyntheticEvent) => {
      eventBus?.publish({
        type: DataHoverClearEvent.type,
        payload: {
          raw,
          x: 0,
          y: 0,
          dataId: arc.data.display.title,
        },
      });
    },
    [eventBus, arc.data.display.title]
  );

  const onMouseOut = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      publishDataHoverClearEvent(event);
      tooltip.hideTooltip();
    },
    [publishDataHoverClearEvent, tooltip]
  );

  const onMouseMoveOverArc = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      publishDataHoverEvent(event);

      const owner = event.currentTarget.ownerSVGElement;

      if (owner) {
        const coords = localPoint(owner, event);
        tooltip.showTooltip({
          tooltipLeft: coords!.x,
          tooltipTop: coords!.y,
          tooltipData: getTooltipData(pie, arc, tooltipOptions),
        });
      }
    },
    [publishDataHoverEvent, tooltip, pie, tooltipOptions]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGGElement>) => {
      if (hasDataLinks && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        event.stopPropagation();

        if (openMenu && elementRef.current) {
          // Calculate position from arc center for pie chart
          // For keyboard events, we need to calculate the center of the arc
          const arcCenterAngle = (arc.startAngle + arc.endAngle) / 2;
          const arcRadius = (outerRadius + innerRadius) / 2;
          const centerX = Math.cos(arcCenterAngle - Math.PI / 2) * arcRadius;
          const centerY = Math.sin(arcCenterAngle - Math.PI / 2) * arcRadius;

          const svgElement = elementRef.current.ownerSVGElement;
          const svgRect = svgElement?.getBoundingClientRect();

          if (svgRect) {
            const position = {
              x: svgRect.left + svgRect.width / 2 + centerX,
              y: svgRect.top + svgRect.height / 2 + centerY + window.scrollY,
            };

            // Use the updated API with position object
            openMenu(position);
          } else {
            // Fallback: use the event's currentTarget (SVG element)
            openMenu(event as React.SyntheticEvent<HTMLElement | SVGElement>);
          }
        }
      }
    },
    [hasDataLinks, openMenu, arc, outerRadius, innerRadius]
  );

  const handleFocus = useCallback(
    (event: React.FocusEvent<SVGGElement>) => {
      // Clear any pending blur timeout - focus has returned to this element or a related element
      // This prevents clearing the hover state when focus moves between related UI elements
      // (e.g., from the pie slice to an opened context menu)
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      publishDataHoverEvent(event);
    },
    [publishDataHoverEvent]
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<SVGGElement>) => {
      // Delay clearing the hover state to handle focus transitions between related elements.
      // When a context menu opens, focus may move from the pie slice to the menu, triggering
      // a blur event. The timeout allows us to check if focus has actually left the component
      // or just moved to a related element (like the menu). If focus returns within 100ms,
      // handleFocus will clear this timeout.
      blurTimeoutRef.current = setTimeout(() => {
        // Only clear hover state if focus has actually left this element
        if (elementRef.current && document.activeElement !== elementRef.current) {
          publishDataHoverClearEvent(event);
        }
        blurTimeoutRef.current = null;
      }, 100);
    },
    [publishDataHoverClearEvent]
  );

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const pieStyle = getSvgStyle(highlightState, styles);

  return (
    <g
      ref={elementRef}
      key={arc.data.display.title}
      className={pieStyle}
      onMouseMove={tooltipOptions.mode !== 'none' ? onMouseMoveOverArc : undefined}
      onMouseOut={onMouseOut}
      onClick={openMenu}
      tabIndex={shouldBeFocusable ? 0 : -1}
      role={shouldBeFocusable ? 'link' : undefined}
      aria-label={t('piechart.data-link-label', '{{title}} - Data link', { title: arc.data.display.title })}
      onKeyDown={shouldBeFocusable ? handleKeyDown : undefined}
      onFocus={hasDataLinks ? handleFocus : undefined}
      onBlur={hasDataLinks ? handleBlur : undefined}
      data-testid={selectors.components.Panels.Visualization.PieChart.svgSlice}
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
  tooltipOptions: VizTooltipOptions
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
          color: pieArc.data.display.color ?? FALLBACK_COLOR,
          label: pieArc.data.display.title,
          value: formattedValueToString(pieArc.data.display),
          isActive: pieArc.index === arc.index,
        };
      });
  }
  return [
    {
      color: arc.data.display.color ?? FALLBACK_COLOR,
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
        outline: 'none',
        [theme.transitions.handleMotion('no-preference')]: {
          transition: 'all 200ms ease-in-out',
        },
      }),
      highlighted: css({
        outline: 'none',
        [theme.transitions.handleMotion('no-preference')]: {
          transition: 'all 200ms ease-in-out',
        },
        transform: 'scale3d(1.03, 1.03, 1)',
      }),
      deemphasized: css({
        outline: 'none',
        [theme.transitions.handleMotion('no-preference')]: {
          transition: 'all 200ms ease-in-out',
        },
        fillOpacity: 0.5,
      }),
    },
    tooltipPortal: css(getTooltipContainerStyles(theme)),
  };
};
