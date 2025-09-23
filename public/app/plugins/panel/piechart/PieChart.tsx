import { css } from '@emotion/css';
import { localPoint } from '@visx/event';
import { RadialGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import Pie, { PieArcDatum, ProvidedProps } from '@visx/shape/lib/shapes/Pie';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import { UseTooltipParams } from '@visx/tooltip/lib/hooks/useTooltip';
import { useCallback } from 'react';
import * as React from 'react';
import tinycolor from 'tinycolor2';

import {
  FieldDisplay,
  FALLBACK_COLOR,
  formattedValueToString,
  GrafanaTheme2,
  DataHoverClearEvent,
  DataHoverEvent,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { VizTooltipOptions } from '@grafana/schema';
import {
  useTheme2,
  useStyles2,
  SeriesTableRowProps,
  DataLinksContextMenu,
  SeriesTable,
  usePanelContext,
} from '@grafana/ui';
import { getTooltipContainerStyles } from '@grafana/ui/src/themes/mixins';
import { useComponentInstanceId } from '@grafana/ui/src/utils/useComponetInstanceId';

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
  highlightedTitle?: string;
  displayLabels?: PieChartLabels[];
  useGradients?: boolean; // not used?
  tooltipOptions: VizTooltipOptions;
}

export const PieChart = ({
  fieldDisplayValues,
  pieType,
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
                      <DataLinksContextMenu key={arc.index} links={arc.data.getLinks}>
                        {(api) => (
                          <PieSlice
                            tooltip={tooltip}
                            highlightState={highlightState}
                            arc={arc}
                            pie={pie}
                            fill={getGradientColor(color)}
                            openMenu={api.openMenu}
                            tooltipOptions={tooltipOptions}
                          />
                        )}
                      </DataLinksContextMenu>
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
  openMenu?: (event: React.MouseEvent<SVGElement>) => void;
}

function PieSlice({ arc, pie, highlightState, openMenu, fill, tooltip, tooltipOptions }: SliceProps) {
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
          tooltipData: getTooltipData(pie, arc, tooltipOptions),
        });
      }
    },
    [eventBus, arc, tooltip, pie, tooltipOptions]
  );

  const pieStyle = getSvgStyle(highlightState, styles);

  return (
    <g
      key={arc.data.display.title}
      className={pieStyle}
      onMouseMove={tooltipOptions.mode !== 'none' ? onMouseMoveOverArc : undefined}
      onMouseOut={onMouseOut}
      onClick={openMenu}
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
        return !customConfig?.hideFrom?.tooltip && !customConfig?.hideFrom?.viz;
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
