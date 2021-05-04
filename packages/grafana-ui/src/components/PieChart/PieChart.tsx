import React, { FC, useEffect, useState } from 'react';
import {
  DataHoverClearEvent,
  DataHoverEvent,
  FALLBACK_COLOR,
  FieldDisplay,
  formattedValueToString,
  getFieldDisplayValues,
  GrafanaTheme2,
} from '@grafana/data';
import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import tinycolor from 'tinycolor2';
import Pie, { PieArcDatum, ProvidedProps } from '@visx/shape/lib/shapes/Pie';
import { Group } from '@visx/group';
import { RadialGradient } from '@visx/gradient';
import { localPoint } from '@visx/event';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import { useComponentInstanceId } from '../../utils/useComponetInstanceId';
import { css } from '@emotion/css';
import { VizLegend, VizLegendItem } from '..';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode } from '../VizLegend/models.gen';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';
import { UseTooltipParams } from '@visx/tooltip/lib/hooks/useTooltip';
import {
  PieChartLabels,
  PieChartLegendOptions,
  PieChartLegendValues,
  PieChartProps,
  PieChartSvgProps,
  PieChartType,
} from './types';
import { getTooltipContainerStyles } from '../../themes/mixins';
import { SeriesTable, SeriesTableRowProps, VizTooltipOptions } from '../VizTooltip';
import { usePanelContext } from '../PanelChrome';
import { Subscription } from 'rxjs';

const defaultLegendOptions: PieChartLegendOptions = {
  displayMode: LegendDisplayMode.List,
  placement: 'right',
  calcs: [],
  values: [PieChartLegendValues.Percent],
};

/**
 * @beta
 */
export function PieChart(props: PieChartProps) {
  const {
    data,
    timeZone,
    reduceOptions,
    fieldConfig,
    replaceVariables,
    tooltipOptions,
    width,
    height,
    ...restProps
  } = props;

  const theme = useTheme2();
  const highlightedTitle = useSliceHighlightState();
  const fieldDisplayValues = getFieldDisplayValues({
    fieldConfig,
    reduceOptions,
    data,
    theme: theme,
    replaceVariables,
    timeZone,
  });

  return (
    <VizLayout width={width} height={height} legend={getLegend(props, fieldDisplayValues)}>
      {(vizWidth: number, vizHeight: number) => {
        return (
          <PieChartSvg
            width={vizWidth}
            height={vizHeight}
            highlightedTitle={highlightedTitle}
            fieldDisplayValues={fieldDisplayValues}
            tooltipOptions={tooltipOptions}
            {...restProps}
          />
        );
      }}
    </VizLayout>
  );
}

function getLegend(props: PieChartProps, displayValues: FieldDisplay[]) {
  const { legendOptions = defaultLegendOptions } = props;

  if (legendOptions.displayMode === LegendDisplayMode.Hidden) {
    return undefined;
  }
  const values = displayValues.map((v) => v.display);
  const total = values.reduce((acc, item) => item.numeric + acc, 0);

  const legendItems = values.map<VizLegendItem>((value, idx) => {
    return {
      label: value.title ?? '',
      color: value.color ?? FALLBACK_COLOR,
      yAxis: 1,
      getItemKey: () => (value.title ?? '') + idx,
      getDisplayValues: () => {
        const valuesToShow = legendOptions.values ?? [];
        let displayValues = [];

        if (valuesToShow.includes(PieChartLegendValues.Value)) {
          displayValues.push({ numeric: value.numeric, text: formattedValueToString(value), title: 'Value' });
        }

        if (valuesToShow.includes(PieChartLegendValues.Percent)) {
          const fractionOfTotal = value.numeric / total;
          const percentOfTotal = fractionOfTotal * 100;

          displayValues.push({
            numeric: fractionOfTotal,
            percent: percentOfTotal,
            text: percentOfTotal.toFixed(0) + '%',
            title: valuesToShow.length > 1 ? 'Percent' : undefined,
          });
        }

        return displayValues;
      },
    };
  });

  return <VizLegend items={legendItems} placement={legendOptions.placement} displayMode={legendOptions.displayMode} />;
}

function useSliceHighlightState() {
  const [highlightedTitle, setHighlightedTitle] = useState<string>();
  const { eventBus } = usePanelContext();

  useEffect(() => {
    const setHighlightedSlice = (event: DataHoverEvent) => {
      setHighlightedTitle(event.payload.dataId);
    };

    const resetHighlightedSlice = (event: DataHoverClearEvent) => {
      setHighlightedTitle(undefined);
    };

    const subs = new Subscription()
      .add(eventBus.getStream(DataHoverEvent).subscribe({ next: setHighlightedSlice }))
      .add(eventBus.getStream(DataHoverClearEvent).subscribe({ next: resetHighlightedSlice }));

    return () => {
      subs.unsubscribe();
    };
  }, [setHighlightedTitle, eventBus]);

  return highlightedTitle;
}

export const PieChartSvg: FC<PieChartSvgProps> = ({
  fieldDisplayValues,
  pieType,
  width,
  height,
  highlightedTitle,
  displayLabels = [],
  tooltipOptions,
}) => {
  const theme = useTheme2();
  const componentInstanceId = useComponentInstanceId('PieChart');
  const styles = useStyles2(getStyles);
  const tooltip = useTooltip<SeriesTableRowProps[]>();
  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  if (fieldDisplayValues.length < 0) {
    return <div>No data</div>;
  }

  const getValue = (d: FieldDisplay) => d.display.numeric;
  const getGradientId = (color: string) => `${componentInstanceId}-${tinycolor(color).toHex()}`;
  const getGradientColor = (color: string) => {
    return `url(#${getGradientId(color)})`;
  };

  const showLabel = displayLabels.length > 0;
  const showTooltip = tooltipOptions.mode !== 'none' && tooltip.tooltipOpen;
  const total = fieldDisplayValues.reduce((acc, item) => item.display.numeric + acc, 0);
  const layout = getPieLayout(width, height, pieType);
  const colors = [
    ...new Set(fieldDisplayValues.map((fieldDisplayValue) => fieldDisplayValue.display.color ?? FALLBACK_COLOR)),
  ];

  return (
    <div className={styles.container}>
      <svg width={layout.size} height={layout.size} ref={containerRef}>
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
            data={fieldDisplayValues}
            pieValue={getValue}
            outerRadius={layout.outerRadius}
            innerRadius={layout.innerRadius}
            cornerRadius={3}
            padAngle={0.005}
          >
            {(pie) => (
              <>
                {pie.arcs.map((arc) => {
                  let color = arc.data.display.color ?? FALLBACK_COLOR;
                  const highlighted = highlightedTitle === arc.data.display.title;
                  if (arc.data.hasLinks && arc.data.getLinks) {
                    return (
                      <DataLinksContextMenu config={arc.data.field} key={arc.index} links={arc.data.getLinks}>
                        {(api) => (
                          <PieSlice
                            tooltip={tooltip}
                            highlighted={highlighted}
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
                        highlighted={highlighted}
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
                  pie.arcs.map((arc) => (
                    <PieLabel
                      arc={arc}
                      key={arc.index}
                      outerRadius={layout.outerRadius}
                      innerRadius={layout.innerRadius}
                      displayLabels={displayLabels}
                      total={total}
                      color={theme.colors.text.primary}
                    />
                  ))}
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
  highlighted?: boolean;
  fill: string;
  tooltip: UseTooltipParams<SeriesTableRowProps[]>;
  tooltipOptions: VizTooltipOptions;
  openMenu?: (event: React.MouseEvent<SVGElement>) => void;
}

function PieSlice({ arc, pie, highlighted, openMenu, fill, tooltip, tooltipOptions }: SliceProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const onMouseMoveOverArc = (event: any) => {
    const coords = localPoint(event.target.ownerSVGElement, event);
    tooltip.showTooltip({
      tooltipLeft: coords!.x,
      tooltipTop: coords!.y,
      tooltipData: getTooltipData(pie, arc, tooltipOptions),
    });
  };

  return (
    <g
      key={arc.data.display.title}
      className={highlighted ? styles.svgArg.highlighted : styles.svgArg.normal}
      onMouseMove={tooltipOptions.mode !== 'none' ? onMouseMoveOverArc : undefined}
      onMouseOut={tooltip.hideTooltip}
      onClick={openMenu}
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
  total: number;
  color: string;
}

function PieLabel({ arc, outerRadius, innerRadius, displayLabels, total, color }: LabelProps) {
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
    <g>
      <text
        fill={color}
        x={labelX}
        y={labelY}
        dy=".33em"
        fontSize={labelFontSize}
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
            {((arc.data.display.numeric / total) * 100).toFixed(0) + '%'}
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
    return pie.arcs.map((pieArc) => {
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
    .spin(8)
    .toRgbString();
}

function getGradientColorTo(color: string, theme: GrafanaTheme2) {
  return tinycolor(color)
    .darken(10 * (theme.isDark ? 1 : -0.7))
    .spin(-8)
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    svgArg: {
      normal: css`
        transition: all 200ms ease-in-out;
        &:hover {
          transform: scale3d(1.03, 1.03, 1);
        }
      `,
      highlighted: css`
        transition: all 200ms ease-in-out;
        transform: scale3d(1.03, 1.03, 1);
      `,
    },
    tooltipPortal: css`
      ${getTooltipContainerStyles(theme)}
    `,
  };
};
